// The sign-in decisions (#52), driven with a fake auth client: src/auth/session.ts. The screens that
// render them are tests/screens/sign-in.spec.ts, and the database half is tests/db/sign-in.test.ts.
//
// The fake's errors are supabase-js's own classes, built with the answers local Auth gave on
// 2026-10-01: an address with an account got 200 `{}`, and one without got
// 422 {"code":422,"error_code":"otp_disabled","msg":"Signups not allowed for otp"}.
import {
  AuthApiError,
  AuthRetryableFetchError,
  AuthSessionMissingError,
  type AuthChangeEvent,
  type AuthError,
  type Session,
} from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import {
  createSignIn,
  createSignOutHooks,
  type AuthClient,
  type FirstNameRead,
  type SignOutHooks,
  type View,
} from '../../src/auth/session.ts'

const SESSION = { access_token: 'token', user: { id: 'user' } } as unknown as Session
const OTP_DISABLED = new AuthApiError('Signups not allowed for otp', 422, 'otp_disabled')
const NO_ANSWER = new AuthRetryableFetchError('Failed to fetch', 0)

type SessionRead = { session: Session | null; error: AuthError | null }

/** A fake auth client. `sessions` are what getSession answers, in turn; the last one repeats. */
function fakeAuth(
  options: {
    sessions?: SessionRead[]
    otpError?: AuthError | null
    otpThrows?: boolean
    signOut?: (auth: { sessions: SessionRead[] }) => AuthError | null
  } = {},
) {
  const sessions = options.sessions ?? [{ session: null, error: null }]
  const calls: Array<[string, unknown]> = []
  const listeners: Array<(event: AuthChangeEvent, session: Session | null) => void> = []
  const auth: AuthClient = {
    async getSession() {
      const read = sessions.length > 1 ? sessions.shift() : sessions[0]
      calls.push(['getSession', undefined])
      return { data: { session: read?.session ?? null }, error: read?.error ?? null }
    },
    async signInWithOtp(credentials) {
      calls.push(['signInWithOtp', credentials])
      if (options.otpThrows) throw new TypeError('not an AuthError')
      return { error: options.otpError ?? null }
    },
    async signOut(scope) {
      calls.push(['signOut', scope])
      const error = options.signOut ? options.signOut({ sessions }) : null
      return { error }
    },
    onAuthStateChange(callback) {
      listeners.push(callback)
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              listeners.splice(listeners.indexOf(callback), 1)
            },
          },
        },
      }
    },
  }
  const emit = (event: AuthChangeEvent) => {
    for (const listener of [...listeners]) listener(event, null)
  }
  return { auth, calls, emit, listeners }
}

const named = (firstName: string | null) => async (): Promise<FirstNameRead> => ({ ok: true, firstName })
const readFails = async (): Promise<FirstNameRead> => ({ ok: false })

/** The sessions a working sign-out passes through: signed in, then gone once signOut has run. */
function signedInThenGone() {
  return {
    sessions: [{ session: SESSION, error: null }],
    signOut: ({ sessions }: { sessions: SessionRead[] }) => {
      sessions.splice(0, sessions.length, { session: null, error: null })
      return null
    },
  }
}

describe('asking for a sign-in link (#52)', () => {
  it('asks with shouldCreateUser false, for the address entered, returning to the origin it was asked from', async () => {
    const { auth, calls } = fakeAuth()
    const signIn = createSignIn(auth, named(null), createSignOutHooks())
    // Two origins, so a constant cannot pass both (cairn memory, two-factory-defaults-can-collide).
    await signIn.requestLink('jordan@example.test', 'https://dockbox.example.test')
    await signIn.requestLink('dana@example.test', 'http://127.0.0.1:4173')
    expect(calls).toEqual([
      [
        'signInWithOtp',
        {
          email: 'jordan@example.test',
          options: { shouldCreateUser: false, emailRedirectTo: 'https://dockbox.example.test' },
        },
      ],
      [
        'signInWithOtp',
        {
          email: 'dana@example.test',
          options: { shouldCreateUser: false, emailRedirectTo: 'http://127.0.0.1:4173' },
        },
      ],
    ])
  })

  // The enumeration case. Each answer the server can give an address is shown as sent.
  it.each([
    ['an address with an account (200)', null],
    ['an address with no account (422 otp_disabled)', OTP_DISABLED],
    ['a mail failure (500)', new AuthRetryableFetchError('Error sending magic link email', 500)],
    ['a rate limit (429)', new AuthApiError('email rate limit exceeded', 429, 'over_email_send_rate_limit')],
  ])('says sent for %s', async (_case, otpError) => {
    const { auth } = fakeAuth({ otpError })
    const signIn = createSignIn(auth, named(null), createSignOutHooks())
    expect(await signIn.requestLink('someone@example.test', 'http://localhost:5173')).toBe('sent')
  })

  it('says unreachable only when the request got no answer, which is the same for every address', async () => {
    const answered = createSignIn(fakeAuth().auth, named(null), createSignOutHooks())
    const noAnswer = createSignIn(fakeAuth({ otpError: NO_ANSWER }).auth, named(null), createSignOutHooks())
    const threw = createSignIn(fakeAuth({ otpThrows: true }).auth, named(null), createSignOutHooks())
    expect([
      await answered.requestLink('a@example.test', 'http://localhost:5173'),
      await noAnswer.requestLink('a@example.test', 'http://localhost:5173'),
      await threw.requestLink('a@example.test', 'http://localhost:5173'),
    ]).toEqual(['sent', 'unreachable', 'unreachable'])
  })
})

describe('the screen the app opens on (#52)', () => {
  async function bootWith(sessions: SessionRead[], read: () => Promise<FirstNameRead>): Promise<View> {
    return createSignIn(fakeAuth({ sessions }).auth, read, createSignOutHooks()).boot()
  }

  it('opens signed in as the person the session is linked to', async () => {
    expect(await bootWith([{ session: SESSION, error: null }], named('Jordan'))).toEqual({
      name: 'signed-in',
      firstName: 'Jordan',
    })
  })

  it("opens on 'not on a roster' for a session linked to no person", async () => {
    expect(await bootWith([{ session: SESSION, error: null }], named(null))).toEqual({
      name: 'not-on-roster',
    })
  })

  it('opens on the sign-in screen for a null session with no error, and reads no name', async () => {
    let reads = 0
    const view = await bootWith([{ session: null, error: null }], async () => {
      reads += 1
      return { ok: true, firstName: 'Jordan' }
    })
    expect({ view, reads }).toEqual({ view: { name: 'sign-in' }, reads: 0 })
  })

  // Offline past the access token's expiry: still signed in, and not known to be otherwise.
  it('opens on the problem screen, not the sign-in screen, for a null session WITH an error', async () => {
    expect(await bootWith([{ session: null, error: NO_ANSWER }], named('Jordan'))).toEqual({
      name: 'problem',
      problem: 'unreachable',
    })
  })

  it('opens on the problem screen when the name cannot be read', async () => {
    expect(await bootWith([{ session: SESSION, error: null }], readFails)).toEqual({
      name: 'problem',
      problem: 'unreachable',
    })
  })
})

describe('signing out (#52)', () => {
  it("ends this device's session only, and lands on the sign-in screen once it is gone", async () => {
    const { auth, calls } = fakeAuth(signedInThenGone())
    const view = await createSignIn(auth, named('Jordan'), createSignOutHooks()).signOut()
    expect({ view, signOut: calls.filter(([name]) => name === 'signOut') }).toEqual({
      view: { name: 'sign-in' },
      signOut: [['signOut', { scope: 'local' }]],
    })
  })

  it('runs every sign-out hook before the session is ended', async () => {
    const order: string[] = []
    const hooks = createSignOutHooks()
    hooks.add(() => {
      order.push('wipe cards')
    })
    hooks.add(async () => {
      order.push('second hook')
    })
    const fake = fakeAuth(signedInThenGone())
    const signOut = fake.auth.signOut.bind(fake.auth)
    fake.auth.signOut = async (scope) => {
      order.push('signOut')
      return signOut(scope)
    }
    await createSignIn(fake.auth, named('Jordan'), hooks).signOut()
    expect(order).toEqual(['wipe cards', 'second hook', 'signOut'])
  })

  it('still ends the session and runs the other hooks when one hook fails, then says it did not finish', async () => {
    const ran: string[] = []
    const hooks = createSignOutHooks()
    hooks.add(() => {
      throw new Error('wipe failed')
    })
    hooks.add(() => {
      ran.push('second hook')
    })
    const { auth, calls } = fakeAuth(signedInThenGone())
    const view = await createSignIn(auth, named('Jordan'), hooks).signOut()
    expect({ view, ran, ended: calls.some(([name]) => name === 'signOut') }).toEqual({
      view: { name: 'problem', problem: 'sign-out-unfinished' },
      ran: ['second hook'],
      ended: true,
    })
  })

  // Offline past expiry, signOut() returns the session error and removes nothing.
  it('says sign-out did not finish while the session is not known to be gone', async () => {
    const { auth } = fakeAuth({
      sessions: [{ session: null, error: NO_ANSWER }],
      signOut: () => NO_ANSWER,
    })
    expect(await createSignIn(auth, named('Jordan'), createSignOutHooks()).signOut()).toEqual({
      name: 'problem',
      problem: 'sign-out-unfinished',
    })
  })

  it('lands on the sign-in screen when the logout request failed but the session is gone', async () => {
    // auth-js removes the session and still returns the error for a failed logout (cairn memory).
    const { auth } = fakeAuth({
      sessions: [{ session: SESSION, error: null }],
      signOut: ({ sessions }) => {
        sessions.splice(0, sessions.length, { session: null, error: null })
        return new AuthRetryableFetchError('Failed to fetch', 0)
      },
    })
    expect(await createSignIn(auth, named('Jordan'), createSignOutHooks()).signOut()).toEqual({
      name: 'sign-in',
    })
  })

  it('treats a missing session as gone', async () => {
    const { auth } = fakeAuth({ signOut: () => new AuthSessionMissingError() })
    expect(await createSignIn(auth, named(null), createSignOutHooks()).signOut()).toEqual({ name: 'sign-in' })
  })
})

describe('the sign-out hook the card cache uses (#52)', () => {
  it('stops running a hook once it is removed', async () => {
    const hooks: SignOutHooks = createSignOutHooks()
    const ran: string[] = []
    const remove = hooks.add(() => {
      ran.push('removed')
    })
    hooks.add(() => {
      ran.push('kept')
    })
    remove()
    expect({ failed: await hooks.run(), ran }).toEqual({ failed: [], ran: ['kept'] })
  })

  it('runs the hooks once when a session ended elsewhere reaches this device, then shows the sign-in screen', async () => {
    let wipes = 0
    const hooks = createSignOutHooks()
    hooks.add(() => {
      wipes += 1
    })
    const { auth, emit } = fakeAuth()
    const shown: View[] = []
    createSignIn(auth, named(null), hooks).watchSignedOut((view) => shown.push(view))
    emit('TOKEN_REFRESHED')
    emit('SIGNED_OUT')
    await expect.poll(() => shown).toEqual([{ name: 'sign-in' }])
    expect(wipes).toBe(1)
  })

  it("does not run the hooks a second time for the SIGNED_OUT this device's own sign-out emits", async () => {
    let wipes = 0
    const hooks = createSignOutHooks()
    hooks.add(() => {
      wipes += 1
    })
    const fake = fakeAuth(signedInThenGone())
    const signOut = fake.auth.signOut.bind(fake.auth)
    fake.auth.signOut = async (scope) => {
      const result = await signOut(scope)
      fake.emit('SIGNED_OUT') // auth-js notifies from inside signOut(), before it resolves
      return result
    }
    const signIn = createSignIn(fake.auth, named('Jordan'), hooks)
    const shown: View[] = []
    signIn.watchSignedOut((view) => shown.push(view))
    expect(await signIn.signOut()).toEqual({ name: 'sign-in' })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect({ wipes, shown }).toEqual({ wipes: 1, shown: [] })
  })

  it('stops watching when told to', () => {
    const { auth, listeners } = fakeAuth()
    const stop = createSignIn(auth, named(null), createSignOutHooks()).watchSignedOut(() => {})
    expect(listeners).toHaveLength(1)
    stop()
    expect(listeners).toHaveLength(0)
  })
})

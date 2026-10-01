// Sign-in by emailed link (#52). The decisions live here, apart from the screens and from the
// Supabase client, so the unit tests (tests/unit/sign-in.test.ts) can drive them with fakes and the
// screens only render the View they are handed.
//
// - A link request says 'check your email' whatever address was entered. Sign-ups are off (D15) and
//   the client asks with shouldCreateUser false, so the server refuses an address that has no account
//   (422 otp_disabled), and may fail on one that has (a mail error is a 500). Every answer the server
//   gives is therefore shown the same way, or the screen would say which addresses have accounts.
//   Only a request that got no answer at all says so instead, and that is the same for every address.
// - Signed out means a null session AND no error. Offline past the access token's expiry,
//   getSession() answers null WITH an error while the refresh token is still stored (cairn memory,
//   supabase-js-signout-and-session-states; #163 re-measures it on the pinned version). Showing the
//   sign-in screen then would stop a coach at the dock who is still signed in, so that state gets
//   the problem screen and its Try again.
// - Sign out ends this device's session only (scope 'local'; owner decision 2026-10-01). Ending a
//   person's access everywhere is the director's (#120). Every sign-out hook runs first, so the
//   emergency-card cache is wiped even when the server cannot be reached.
import {
  isAuthRetryableFetchError,
  type AuthChangeEvent,
  type AuthError,
  type Session,
} from '@supabase/supabase-js'

export type Problem = 'unreachable' | 'sign-out-unfinished'

export type View =
  | { name: 'loading' }
  | { name: 'sign-in' }
  | { name: 'signed-in'; firstName: string }
  | { name: 'not-on-roster' }
  | { name: 'problem'; problem: Problem }

export type LinkRequest = 'sent' | 'unreachable'

/** The signed-in person's first name: null when the session is linked to no person. `ok` is false
 * when the read did not complete. */
export type FirstNameRead = { ok: true; firstName: string | null } | { ok: false }

/** The part of supabase-js's auth client this module uses. */
export interface AuthClient {
  getSession(): Promise<{ data: { session: Session | null }; error: AuthError | null }>
  signInWithOtp(credentials: {
    email: string
    options: { shouldCreateUser: boolean; emailRedirectTo: string }
  }): Promise<{ error: AuthError | null }>
  signOut(options: { scope: 'local' }): Promise<{ error: AuthError | null }>
  onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void): {
    data: { subscription: { unsubscribe(): void } }
  }
}

export type SignOutHook = () => void | Promise<void>

export interface SignOutHooks {
  /** Registers `hook` to run whenever this device signs out, and returns a function removing it. */
  add(hook: SignOutHook): () => void
  /** Runs every hook to completion, and returns what they threw. One failing does not stop the rest. */
  run(): Promise<unknown[]>
}

export function createSignOutHooks(): SignOutHooks {
  const hooks = new Set<SignOutHook>()
  return {
    add(hook) {
      hooks.add(hook)
      return () => {
        hooks.delete(hook)
      }
    },
    async run() {
      const results = await Promise.allSettled([...hooks].map(async (hook) => hook()))
      return results.flatMap((result) => (result.status === 'rejected' ? [result.reason] : []))
    },
  }
}

/** The app's sign-out hooks. The emergency-card cache registers its wipe here (charter: cached cards
 * are wiped after the event and on sign-out). A hook runs before the session is ended, on a Sign out
 * tap and when a session ended elsewhere reaches this device. Sign-out is not finished until every
 * hook has succeeded, so a failing wipe shows the problem screen and its Try again runs them all. */
export const signOutHooks = createSignOutHooks()
export const onSignOut = signOutHooks.add

type SessionState = 'signed-in' | 'signed-out' | 'unknown'

async function sessionState(auth: AuthClient): Promise<SessionState> {
  const { data, error } = await auth.getSession()
  if (data.session) return 'signed-in'
  return error ? 'unknown' : 'signed-out'
}

export function createSignIn(
  auth: AuthClient,
  readFirstName: () => Promise<FirstNameRead>,
  hooks: SignOutHooks = signOutHooks,
) {
  // auth-js emits SIGNED_OUT from inside this device's own signOut(). The listener stands aside
  // then, so the hooks run once and the sign-out decides the screen.
  let endingSession = false

  async function boot(): Promise<View> {
    try {
      const state = await sessionState(auth)
      if (state === 'signed-out') return { name: 'sign-in' }
      if (state === 'unknown') return { name: 'problem', problem: 'unreachable' }
      const read = await readFirstName()
      if (!read.ok) return { name: 'problem', problem: 'unreachable' }
      return read.firstName === null
        ? { name: 'not-on-roster' }
        : { name: 'signed-in', firstName: read.firstName }
    } catch {
      return { name: 'problem', problem: 'unreachable' }
    }
  }

  /** Asks for a link to `email` that returns to `origin`. */
  async function requestLink(email: string, origin: string): Promise<LinkRequest> {
    try {
      const { error } = await auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false, emailRedirectTo: origin },
      })
      // Status 0 is a request that got no answer. A 5xx is an AuthRetryableFetchError too, but it is
      // an answer, and one that can depend on the address.
      return error && isAuthRetryableFetchError(error) && error.status === 0 ? 'unreachable' : 'sent'
    } catch {
      return 'unreachable'
    }
  }

  async function signOut(): Promise<View> {
    endingSession = true
    try {
      const failed = await hooks.run()
      // Its error is not read: what decides is whether the session is gone, read next. A failed
      // logout request still removes the session, except offline past expiry.
      await auth.signOut({ scope: 'local' })
      const gone = (await sessionState(auth)) === 'signed-out'
      return gone && failed.length === 0
        ? { name: 'sign-in' }
        : { name: 'problem', problem: 'sign-out-unfinished' }
    } catch {
      return { name: 'problem', problem: 'sign-out-unfinished' }
    } finally {
      endingSession = false
    }
  }

  /** Calls `show` with the next view when a session ended elsewhere reaches this device as
   * SIGNED_OUT, after running the sign-out hooks. Returns a function that stops watching. */
  function watchSignedOut(show: (view: View) => void): () => void {
    const { data } = auth.onAuthStateChange((event) => {
      if (event !== 'SIGNED_OUT' || endingSession) return
      // Kept synchronous: supabase-js holds its auth lock while it notifies.
      void hooks.run().then((failed) => {
        show(failed.length === 0 ? { name: 'sign-in' } : { name: 'problem', problem: 'sign-out-unfinished' })
      })
    })
    return () => data.subscription.unsubscribe()
  }

  return { boot, requestLink, signOut, watchSignedOut }
}

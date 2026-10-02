// Admission (#59, D15): only pre-created roster people get a session. The admit Edge Function, called
// through the local gateway with the service-role key, creates a confirmed account for the email a
// people row carries and links it from the server. A stranger, or a roster person nobody admitted,
// who asks for a sign-in link gets no account and no session.
//
// Every refusal is checked on state as well as on the answer: auth.users and people are read back
// over a direct connection, so a refusal that still created an account fails.
//
// Its prove-tests mutation is tests/mutations/admit-anyone.patch, a code mutation: it makes the
// function create the account before checking the roster. Applied in CI by running the workflow by
// hand with `mutation: admit-anyone`, it turns exactly the no-roster case red.
//
// Like the other files here, it needs a local Supabase and its credentials in the environment
// (`npx supabase status -o env`), and fails rather than skipping without them.
import { randomUUID } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

function env(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name]
    if (value) return value
  }
  throw new Error(
    `None of ${names.join(', ')} is set. Run \`npx supabase start\`, then export \`npx supabase status -o env\`.`,
  )
}

const url = env('API_URL', 'SUPABASE_URL')
const anonKey = env('ANON_KEY', 'PUBLISHABLE_KEY')
// The legacy JWT, which is what the edge runtime holds as SUPABASE_SERVICE_ROLE_KEY.
const serviceKey = env('SERVICE_ROLE_KEY')
// For reading auth.users, which no API role serves, and the catalog.
const sql = postgres(env('DB_URL'), { max: 1, onnotice: () => {} })
afterAll(() => sql.end())

const noSession = { auth: { persistSession: false, autoRefreshToken: false } }
const admin = createClient(url, serviceKey, noSession)

// Unique per run, so reruns against the same local database never collide. Every person here is
// invented, and each has this run's id as their last name.
const run = randomUUID().slice(0, 8)
const emailOf = (name: string) => `${name.toLowerCase()}-${run}@example.test`

/** Calls the admit function through the gateway, as the server would, or with another caller's key. */
async function admitEmail(email: string, key = serviceKey): Promise<{ status: number; body: unknown }> {
  const response = await fetch(`${url}/functions/v1/admit`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  return { status: response.status, body: await response.json().catch(() => null) }
}

/** A people row, as the roster sync or a director would write it, with no account. */
async function rosterPerson(name: string, email: string | null = emailOf(name)): Promise<string> {
  const { data, error } = await admin
    .from('people')
    .insert({ first_name: name, last_name: run, email })
    .select('id')
    .single()
  if (error) throw new Error(`insert ${name}: ${error.message}`)
  return (data as { id: string }).id
}

interface AccountRow {
  id: string
  confirmed: boolean
}

/** Every auth user whose email this is, whatever its case. */
async function accountsFor(email: string): Promise<AccountRow[]> {
  return sql<AccountRow[]>`
    select id::text, email_confirmed_at is not null as confirmed
    from auth.users where lower(email) = ${email.toLowerCase()}`
}

async function linkOf(personId: string): Promise<string | null> {
  const [row] = await sql<{ auth_user_id: string | null }[]>`
    select auth_user_id::text from public.people where id = ${personId}`
  if (!row) throw new Error(`no people row ${personId}`)
  return row.auth_user_id
}

/** A real magic-link session for an admitted email (as in sign-in.test.ts). */
async function signedInByLink(email: string): Promise<SupabaseClient> {
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (error) throw new Error(`generate a link for ${email}: ${error.message}`)
  const client = createClient(url, anonKey, noSession)
  const verified = await client.auth.verifyOtp({
    type: 'magiclink',
    token_hash: data.properties.hashed_token,
  })
  if (verified.error) throw new Error(`verify the link for ${email}: ${verified.error.message}`)
  return client
}

describe('the admit function pre-creates a roster person’s account (#59)', () => {
  it('creates a confirmed account for the email a people row carries, and links it from the server', async () => {
    const riley = await rosterPerson('Riley')
    const result = await admitEmail(emailOf('Riley'))
    const accounts = await accountsFor(emailOf('Riley'))
    expect({ result, accounts: accounts.map((a) => a.confirmed) }).toEqual({
      result: { status: 200, body: { personId: riley, accountCreated: true } },
      accounts: [true],
    })
    expect(await linkOf(riley)).toBe(accounts[0]?.id)
  })

  it('matches the email whatever its case or surrounding spaces', async () => {
    const casey = await rosterPerson('Casey')
    const result = await admitEmail(`  ${emailOf('Casey').toUpperCase()} `)
    expect(result).toEqual({ status: 200, body: { personId: casey, accountCreated: true } })
    expect(await accountsFor(emailOf('Casey'))).toHaveLength(1)
  })

  // The function's own body, not only 404: the gateway answers 404 too, for a function it does not
  // serve, and this case passed on that before the function was being served.
  it('refuses an email on no roster, creating no account', async () => {
    const result = await admitEmail(emailOf('Stranger'))
    expect({ result, accounts: await accountsFor(emailOf('Stranger')) }).toEqual({
      result: { status: 404, body: { error: 'no roster person has this email' } },
      accounts: [],
    })
  })

  it('leaves one account and one person when the same email is admitted twice', async () => {
    const morgan = await rosterPerson('Morgan')
    const first = await admitEmail(emailOf('Morgan'))
    const second = await admitEmail(emailOf('Morgan'))
    const [people] = await sql<{ count: number }[]>`
      select count(*)::int from public.people where email = ${emailOf('Morgan')}`
    expect({
      first,
      second,
      accounts: (await accountsFor(emailOf('Morgan'))).length,
      people: people?.count,
    }).toEqual({
      first: { status: 200, body: { personId: morgan, accountCreated: true } },
      second: { status: 200, body: { personId: morgan, accountCreated: false } },
      accounts: 1,
      people: 1,
    })
  })

  // Auth holds one account per email whatever its case, so a second person with the same address
  // could never be admitted. The roster is refused it where it is written.
  it('refuses a second person with the same email, and an email not stored lower-case', async () => {
    await rosterPerson('Taylor')
    const refusals = []
    for (const email of [emailOf('Taylor'), emailOf('Taylor').toUpperCase()]) {
      const { error } = await admin.from('people').insert({ first_name: 'Twin', last_name: run, email })
      refusals.push(error?.code)
    }
    // 23505: unique violation. 23514: check violation, the normalised-email constraint.
    expect(refusals).toEqual(['23505', '23514'])
  })

  it('still makes one account when the same email is admitted twice at once', async () => {
    const drew = await rosterPerson('Drew')
    const both = await Promise.all([admitEmail(emailOf('Drew')), admitEmail(emailOf('Drew'))])
    const accounts = await accountsFor(emailOf('Drew'))
    expect({ statuses: both.map((r) => r.status), accounts: accounts.length }).toEqual({
      statuses: [200, 200],
      accounts: 1,
    })
    expect(await linkOf(drew)).toBe(accounts[0]?.id)
  })

  it('links and confirms an account that already exists for the email, rather than failing', async () => {
    const avery = await rosterPerson('Avery')
    const { data, error } = await admin.auth.admin.createUser({
      email: emailOf('Avery'),
      email_confirm: false,
    })
    if (error) throw new Error(`create Avery's stray account: ${error.message}`)
    const result = await admitEmail(emailOf('Avery'))
    expect({ result, accounts: await accountsFor(emailOf('Avery')) }).toEqual({
      result: { status: 200, body: { personId: avery, accountCreated: false } },
      accounts: [{ id: data.user.id, confirmed: true }],
    })
    expect(await linkOf(avery)).toBe(data.user.id)
  })

  it('refuses every caller but the service role, creating nothing', async () => {
    const quinn = await rosterPerson('Quinn')
    // A signed-in person: admitted first, so their session is real.
    await rosterPerson('Signed')
    await admitEmail(emailOf('Signed'))
    const { data } = await (await signedInByLink(emailOf('Signed'))).auth.getSession()
    const sessionToken = data.session?.access_token
    if (!sessionToken) throw new Error('no session for Signed')

    // Both keys are valid JWTs, so the gateway lets them through and the refusal is the function's.
    const refused = { status: 401, body: { error: 'service role only' } }
    const answers = {
      anon: await admitEmail(emailOf('Quinn'), anonKey),
      signedIn: await admitEmail(emailOf('Quinn'), sessionToken),
    }
    expect({ answers, accounts: await accountsFor(emailOf('Quinn')), link: await linkOf(quinn) }).toEqual({
      answers: { anon: refused, signedIn: refused },
      accounts: [],
      link: null,
    })
  })

  it('refuses a body with no email address in it', async () => {
    expect(await admitEmail('not an address')).toEqual({
      status: 400,
      body: { error: 'not an email address' },
    })
  })
})

describe('only a pre-created account gets a session (#59)', () => {
  // The app asks with shouldCreateUser false (#52). A caller may send true, so both are asked, and
  // Auth's sign-up switch is what refuses.
  it.each([
    ['a stranger', 'Outsider', false],
    ['a roster person nobody admitted', 'Waiting', true],
  ])('creates no account and no session for %s asking for a link', async (_, name, onRoster) => {
    if (onRoster) await rosterPerson(name)
    const client = createClient(url, anonKey, noSession)
    const asked = []
    for (const shouldCreateUser of [false, true]) {
      const { data, error } = await client.auth.signInWithOtp({
        email: emailOf(name),
        options: { shouldCreateUser },
      })
      asked.push({ shouldCreateUser, code: error?.code, user: data.user, session: data.session })
    }
    expect({ asked, accounts: await accountsFor(emailOf(name)) }).toEqual({
      asked: [
        { shouldCreateUser: false, code: 'otp_disabled', user: null, session: null },
        { shouldCreateUser: true, code: 'signup_disabled', user: null, session: null },
      ],
      accounts: [],
    })
  })
})

describe('a signed-in person cannot move their link (#59)', () => {
  let jamie: SupabaseClient
  let jamieId: string
  let otherId: string
  let otherAccount: string

  beforeAll(async () => {
    jamieId = await rosterPerson('Jamie')
    otherId = await rosterPerson('Other')
    await admitEmail(emailOf('Jamie'))
    await admitEmail(emailOf('Other'))
    jamie = await signedInByLink(emailOf('Jamie'))
    const link = await linkOf(otherId)
    if (!link) throw new Error('Other was not admitted')
    otherAccount = link
  })

  // Taskr issue 23: a client that could write auth_user_id could point its own row at someone else's
  // account, or another row at its own. Checked on state, not only on the error.
  it("refuses an authenticated client's update of people.auth_user_id", async () => {
    const before = await linkOf(jamieId)
    const { error } = await jamie.from('people').update({ auth_user_id: otherAccount }).eq('id', jamieId)
    expect({ code: error?.code, after: await linkOf(jamieId) }).toEqual({ code: '42501', after: before })
  })

  // tender issue 267: user_metadata is the user's to write, so it must decide nothing.
  it('still reads only their own row after rewriting their own user_metadata', async () => {
    const { error } = await jamie.auth.updateUser({
      data: { person_id: otherId, auth_user_id: otherAccount, role: 'director' },
    })
    expect(error).toBeNull()
    await jamie.auth.refreshSession()
    const me = await jamie.from('me').select('id')
    const people = await jamie.from('people').select('id')
    expect({ me: me.data, people: people.data }).toEqual({ me: [{ id: jamieId }], people: [{ id: jamieId }] })
  })

  it('has no policy or function in public or private that reads user_metadata', async () => {
    const readers = await sql<{ name: string }[]>`
      select format('%I.%I', n.nspname, p.proname) as name
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'private') and p.prosrc ~* 'user_meta'
      union all
      select format('policy %I on %I.%I', policyname, schemaname, tablename)
      from pg_policies
      where schemaname in ('public', 'private')
        and (coalesce(qual, '') ~* 'user_meta' or coalesce(with_check, '') ~* 'user_meta')`
    expect(readers).toEqual([])
  })
})

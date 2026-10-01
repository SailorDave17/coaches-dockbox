// Sign-in by emailed link, the database half (#52). A pre-created person signs in with a real
// magic-link session and reads their own first name through public.me, which returns their own
// people row and nothing else, whatever roster they may read. A guardian, who holds no membership,
// reads their own row too. A session linked to no person reads no person, program or membership,
// and public.me returns nothing, which is what the app shows as "You're not on a Dockbox roster yet".
// The screens are tests/screens/sign-in.spec.ts and the decisions tests/unit/sign-in.test.ts.
//
// Its prove-tests mutation is tests/mutations/me-ignores-caller.sql, applied in CI by running the
// workflow by hand with `mutation: me-ignores-caller`. That file names the cases it is predicted to
// turn red.
//
// Like roster-reads.test.ts, it needs a local Supabase and its credentials in the environment
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
const serviceKey = env('SERVICE_ROLE_KEY', 'SECRET_KEY')
// For the club's date, and for reading the view's definition and grants from the catalog.
const sql = postgres(env('DB_URL'), { max: 1, onnotice: () => {} })
afterAll(() => sql.end())

const noSession = { auth: { persistSession: false, autoRefreshToken: false } }
const admin = createClient(url, serviceKey, noSession)

// Unique per run, so reruns against the same local database never collide. Every person here is
// invented, and each has this run's id as their last name.
const run = randomUUID().slice(0, 8)
const password = `pw-${randomUUID()}`

// Jordan coaches JRT's current season and signs in by link. Gina guards Sky and holds no membership.
// Nobody has an account and no people row: the session linked to no person.
const CALLERS = ['Jordan', 'Gina', 'Nobody'] as const
type Caller = (typeof CALLERS)[number]

const emailOf = (caller: Caller) => `${caller.toLowerCase()}-${run}@example.test`
const personIds = new Map<string, string>() // 'Jordan' -> people.id

async function insertOne(table: string, row: Record<string, unknown>): Promise<string> {
  const { data, error } = await admin.from(table).insert(row).select('id').single()
  if (error) throw new Error(`insert into ${table}: ${error.message}`)
  const id = (data as { id?: string }).id
  if (!id) throw new Error(`insert into ${table} came back without an id`)
  return id
}

/** The club's date `days` from today, as club_today() counts it. */
async function clubDay(days: number): Promise<string> {
  const [row] = await sql<{ day: string }[]>`select (public.club_today() + ${days}::int)::text as day`
  if (!row) throw new Error('club_today() returned no row')
  return row.day
}

/** A real magic-link session, as a tapped link gives one: admin generateLink, then the link's token
 * verified with the publishable key (cairn memory, supabase-auth-for-automated-suites). */
async function signedInByLink(caller: Caller): Promise<SupabaseClient> {
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email: emailOf(caller) })
  if (error) throw new Error(`generate a link for ${caller}: ${error.message}`)
  const client = createClient(url, anonKey, noSession)
  const verified = await client.auth.verifyOtp({
    type: 'magiclink',
    token_hash: data.properties.hashed_token,
  })
  if (verified.error) throw new Error(`verify ${caller}'s link: ${verified.error.message}`)
  return client
}

async function signedIn(caller: Caller): Promise<SupabaseClient> {
  const client = createClient(url, anonKey, noSession)
  const { error } = await client.auth.signInWithPassword({ email: emailOf(caller), password })
  if (error) throw new Error(`sign in ${caller}: ${error.message}`)
  return client
}

/** What `client` reads from public.me, as first names. */
async function meOf(client: SupabaseClient): Promise<string[]> {
  const { data, error } = await client.from('me').select('id, first_name')
  expect(error).toBeNull()
  return (data ?? []).map((row) =>
    row.id === personIds.get(row.first_name) ? row.first_name : `${row.first_name} ${row.id}`,
  )
}

/** The first names of every person `client` can read, sorted. */
async function peopleSeenBy(client: SupabaseClient): Promise<string[]> {
  const { data, error } = await client.from('people').select('id, first_name, last_name')
  expect(error).toBeNull()
  return (data ?? [])
    .map((row) => (row.last_name === run ? row.first_name : `${row.first_name} ${row.last_name}`))
    .sort()
}

/** How many people, programs and memberships `client` can read. */
async function rosterRowsSeenBy(client: SupabaseClient) {
  const people = await client.from('people').select('id')
  const programs = await client.from('programs').select('id')
  const memberships = await client.from('memberships').select('person_id')
  for (const read of [people, programs, memberships]) expect(read.error).toBeNull()
  return {
    people: people.data?.length,
    programs: programs.data?.length,
    memberships: memberships.data?.length,
  }
}

beforeAll(async () => {
  const program = await insertOne('programs', { name: `JRT ${run}` })
  const season = await insertOne('seasons', {
    program_id: program,
    name: `Spring ${run}`,
    starts_on: await clubDay(-30),
    ends_on: await clubDay(30),
  })
  for (const caller of CALLERS) {
    const { data, error } = await admin.auth.admin.createUser({
      email: emailOf(caller),
      password,
      email_confirm: true,
    })
    if (error) throw new Error(`create user ${caller}: ${error.message}`)
    if (caller === 'Nobody') continue
    personIds.set(
      caller,
      await insertOne('people', { auth_user_id: data.user.id, first_name: caller, last_name: run }),
    )
  }
  personIds.set('Sky', await insertOne('people', { first_name: 'Sky', last_name: run }))
  for (const [person, role] of [
    ['Jordan', 'coach'],
    ['Sky', 'sailor'],
  ] as const) {
    const { error } = await admin
      .from('memberships')
      .insert({ person_id: personIds.get(person), program_id: program, season_id: season, role })
    if (error) throw new Error(`insert membership for ${person}: ${error.message}`)
  }
  const { error } = await admin
    .from('guardian_links')
    .insert({ guardian_id: personIds.get('Gina'), sailor_id: personIds.get('Sky'), is_primary: true })
  if (error) throw new Error(`link Gina to Sky: ${error.message}`)
})

describe('a pre-created person signs in with an emailed link and reads their own name (#52)', () => {
  it('gives a pre-created coach a magic-link session that reads their own first name from public.me', async () => {
    const jordan = await signedInByLink('Jordan')
    const { data } = await jordan.auth.getSession()
    expect(data.session?.user.email).toBe(emailOf('Jordan'))
    expect(await meOf(jordan)).toEqual(['Jordan'])
  })

  // The view's filter: the coach reads the whole current roster, and public.me is one row of it.
  // "Includes" rather than an exact list: which roster a coach reads is roster-reads.test.ts's claim,
  // and an exact list here would move with roster-ignores-program, by timing (the other files' rows).
  it('returns only the caller from public.me, though the coach reads their roster', async () => {
    const jordan = await signedIn('Jordan')
    expect(await peopleSeenBy(jordan)).toEqual(expect.arrayContaining(['Jordan', 'Sky']))
    expect(await meOf(jordan)).toEqual(['Jordan'])
  })

  // Before #52 a guardian read only their children (#53), so the app could not have named them.
  it('lets a guardian, who holds no membership, read their own row beside their child', async () => {
    const gina = await signedIn('Gina')
    expect(await peopleSeenBy(gina)).toEqual(['Gina', 'Sky'])
    expect(await meOf(gina)).toEqual(['Gina'])
  })
})

describe('a session linked to no person reads nothing (#52)', () => {
  // The positive control: the same reads, by a caller who may make them, in the same run. At least
  // this file's rows, for the reason given on the roster case above.
  it('lets a coach read people, programs and memberships with the same queries', async () => {
    const seen = await rosterRowsSeenBy(await signedIn('Jordan'))
    expect(seen.people).toBeGreaterThanOrEqual(2)
    expect(seen.programs).toBeGreaterThanOrEqual(1)
    expect(seen.memberships).toBeGreaterThanOrEqual(2)
  })

  it('reads no person, program or membership, and gets nothing from public.me', async () => {
    const nobody = await signedIn('Nobody')
    expect({ ...(await rosterRowsSeenBy(nobody)), me: await meOf(nobody) }).toEqual({
      people: 0,
      programs: 0,
      memberships: 0,
      me: [],
    })
  })
})

describe('public.me is a read of people, not a second guard on it (#52)', () => {
  // A definer view would read people past its policies. Supabase's advisors refuse one too
  // (security_definer_view); this says so without them.
  it('runs as the caller (security_invoker)', async () => {
    const [row] = await sql<{ options: string[] | null }[]>`
      select reloptions as options from pg_class where oid = 'public.me'::regclass`
    expect(row?.options).toEqual(['security_invoker=true'])
  })

  it('grants authenticated select on public.me and nothing else, and anon nothing', async () => {
    const rows = await sql<{ held: string }[]>`
      select format('%s %s', r.role, p.privilege) as held
      from unnest(array['anon', 'authenticated']) as r(role)
      cross join unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'])
        as p(privilege)
      where has_table_privilege(r.role, 'public.me'::regclass, p.privilege)
      order by 1`
    expect(rows.map((row) => row.held)).toEqual(['authenticated SELECT'])
  })
})

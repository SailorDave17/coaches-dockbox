// Guardians read only their own children (#53). A guardian is one people row with a guardian_links row
// per child, so a guardian of two sailors carries both links, and a sailor in a split household has a
// link per guardian. A signed-in guardian reads the people rows of the sailors they are currently linked
// to and no one else but themselves (#52); an unlinked guardian reads only themselves. At most one
// current link per sailor is primary. A coach or director reads the current links of the sailors on
// their roster, and no client reads unlinked_at or writes a link. Medical access for guardians is
// tested in medical-access.test.ts.
//
// Its prove-tests mutation is tests/mutations/guardian-read-ignores-unlink.sql, applied in CI by running
// the workflow by hand with `mutation: guardian-read-ignores-unlink`. That file names the case it is
// predicted to turn red.
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
// For the club's date, for reading grants from the catalog, and for reading rows back as `postgres`.
const sql = postgres(env('DB_URL'), { max: 1, onnotice: () => {} })
afterAll(() => sql.end())

const noSession = { auth: { persistSession: false, autoRefreshToken: false } }
const admin = createClient(url, serviceKey, noSession)

// Unique per run, so reruns against the same local database never collide. Every person here is
// invented, and each has this run's id as their last name.
const run = randomUUID().slice(0, 8)
const password = `pw-${randomUUID()}`

// Who signs in. Guardians hold no membership; each coach holds one current one.
const SIGNS_IN = ['Gina', 'Fran', 'Uma', 'Hugo', 'Jordan', 'Lee'] as const
type Caller = (typeof SIGNS_IN)[number]
const COACHES: Array<[Caller, string]> = [
  ['Jordan', 'JRT'],
  ['Lee', 'LTS'],
]

// Sailors, who never sign in, and the program whose current season each sails in.
const SAILORS: Array<[string, string]> = [
  ['Sky', 'JRT'],
  ['Remy', 'JRT'],
  ['Theo', 'LTS'],
]

// [guardian, sailor, is_primary, unlinked]. Gina guards two sailors and is primary for both. Sky's
// household is split: Gina and Fran are both current, and Uma's link to Sky was unlinked yesterday.
const LINKS: Array<[Caller, string, boolean, boolean]> = [
  ['Gina', 'Sky', true, false],
  ['Gina', 'Remy', true, false],
  ['Fran', 'Sky', false, false],
  ['Uma', 'Sky', false, true],
  ['Hugo', 'Theo', true, false],
]

const programIds = new Map<string, string>() // 'JRT' -> id
const seasonIds = new Map<string, string>() // 'JRT' -> its current season's id
const personIds = new Map<string, string>() // 'Sky' -> id

async function insertOne(table: string, row: Record<string, unknown>): Promise<string> {
  const { data, error } = await admin.from(table).insert(row).select('id').single()
  if (error) throw new Error(`insert into ${table}: ${error.message}`)
  const id = (data as { id?: string }).id
  if (!id) throw new Error(`insert into ${table} came back without an id`)
  return id
}

async function insertMembership(person: string, program: string, role: string) {
  const { error } = await admin.from('memberships').insert({
    person_id: personIds.get(person),
    program_id: programIds.get(program),
    season_id: seasonIds.get(program),
    role,
  })
  if (error) throw new Error(`insert membership for ${person}: ${error.message}`)
}

async function insertPerson(name: string, authUserId?: string) {
  personIds.set(
    name,
    await insertOne('people', { auth_user_id: authUserId ?? null, first_name: name, last_name: run }),
  )
}

/** The club's date `days` from today, as club_today() counts it. */
async function clubDay(days: number): Promise<string> {
  const [row] = await sql<{ day: string }[]>`select (public.club_today() + ${days}::int)::text as day`
  if (!row) throw new Error('club_today() returned no row')
  return row.day
}

const emailOf = (caller: Caller) => `${caller.toLowerCase()}-${run}@example.test`

async function signedIn(caller: Caller): Promise<SupabaseClient> {
  const client = createClient(url, anonKey, noSession)
  const { error } = await client.auth.signInWithPassword({ email: emailOf(caller), password })
  if (error) throw new Error(`sign in ${caller}: ${error.message}`)
  return client
}

/** Reverse lookup, so a row from another run shows up by id, never hidden. */
function nameOf(id: string): string {
  for (const [name, value] of personIds) if (value === id) return name
  return `unknown ${id}`
}

/** The first names of every person `caller` can read, sorted. */
async function peopleSeenBy(caller: Caller): Promise<string[]> {
  const client = await signedIn(caller)
  const { data, error } = await client.from('people').select('id, first_name, last_name')
  expect(error).toBeNull()
  return (data ?? [])
    .map((row) => (row.last_name === run ? row.first_name : `${row.first_name} ${row.last_name}`))
    .sort()
}

type Link = { guardian_id: string; sailor_id: string; is_primary: boolean }
const describeLink = (row: Link) =>
  `${nameOf(row.guardian_id)} -> ${nameOf(row.sailor_id)}${row.is_primary ? ' (primary)' : ''}`

/** Every guardian link `caller` can read, as 'Guardian -> Sailor', sorted. */
async function linksSeenBy(caller: Caller): Promise<string[]> {
  const client = await signedIn(caller)
  const { data, error } = await client.from('guardian_links').select('guardian_id, sailor_id, is_primary')
  expect(error).toBeNull()
  return ((data ?? []) as Link[]).map(describeLink).sort()
}

/** Every link of `sailor`, read as `postgres`, past RLS. */
async function linksOf(sailor: string): Promise<string[]> {
  const rows = await sql<(Link & { unlinked: boolean })[]>`
    select guardian_id, sailor_id, is_primary, unlinked_at is not null as unlinked
    from public.guardian_links
    where sailor_id = ${personIds.get(sailor) ?? ''}`
  return rows.map((row) => `${describeLink(row)}${row.unlinked ? ' unlinked' : ''}`).sort()
}

async function link(guardian: string, sailor: string, isPrimary: boolean, unlinkedAt: string | null) {
  return admin.from('guardian_links').insert({
    guardian_id: personIds.get(guardian),
    sailor_id: personIds.get(sailor),
    is_primary: isPrimary,
    unlinked_at: unlinkedAt,
  })
}

const yesterday = () => new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

beforeAll(async () => {
  for (const program of ['JRT', 'LTS']) {
    const programId = await insertOne('programs', { name: `${program} ${run}` })
    programIds.set(program, programId)
    seasonIds.set(
      program,
      await insertOne('seasons', {
        program_id: programId,
        name: `Spring ${run}`,
        starts_on: await clubDay(-30),
        ends_on: await clubDay(30),
      }),
    )
  }
  for (const caller of SIGNS_IN) {
    const { data, error } = await admin.auth.admin.createUser({
      email: emailOf(caller),
      password,
      email_confirm: true,
    })
    if (error) throw new Error(`create user ${caller}: ${error.message}`)
    await insertPerson(caller, data.user.id)
  }
  for (const [coach, program] of COACHES) await insertMembership(coach, program, 'coach')
  for (const [sailor, program] of SAILORS) {
    await insertPerson(sailor)
    await insertMembership(sailor, program, 'sailor')
  }
  // Kit and Kim are sailors with no membership, and Ola and Pia guardians who never sign in. Only the
  // primary-link cases use them, so the links those cases write change no one's reads.
  for (const name of ['Kit', 'Kim', 'Ola', 'Pia']) await insertPerson(name)
  for (const [guardian, sailor, isPrimary, unlinked] of LINKS) {
    const { error } = await link(guardian, sailor, isPrimary, unlinked ? yesterday() : null)
    if (error) throw new Error(`link ${guardian} to ${sailor}: ${error.message}`)
  }
})

// Since #52 every signed-in person also reads their own row, so each guardian below sees themselves.
describe('a guardian reads only their own children (#53)', () => {
  // The positive control: without it, a policy that returned nothing would pass the refusals below.
  it("lets a guardian read their one child, and no other sailor or guardian, Sky's other guardian included", async () => {
    expect(await peopleSeenBy('Fran')).toEqual(['Fran', 'Sky'])
  })

  it("lets another family's guardian read their own child and none of Sky's household", async () => {
    expect(await peopleSeenBy('Hugo')).toEqual(['Hugo', 'Theo'])
  })

  // Uma's link is Sky's, like Fran's, and differs only in being unlinked.
  it('lets a guardian whose link was unlinked read no one but themselves', async () => {
    expect(await peopleSeenBy('Uma')).toEqual(['Uma'])
  })

  it('gives a guardian no read of guardian_links, their own links included', async () => {
    expect(await linksSeenBy('Gina')).toEqual([])
  })
})

describe('a guardian of two sailors is one person with two links, and a sailor has one current primary (#53)', () => {
  it('keeps one people row for a guardian of two sailors, carrying both links, and lets them read both', async () => {
    const [row] = await sql<{ rows: number }[]>`
      select count(*)::int as rows from public.people where first_name = 'Gina' and last_name = ${run}`
    expect(row?.rows).toBe(1)
    const gina = personIds.get('Gina') ?? ''
    const links = await sql<Link[]>`
      select guardian_id, sailor_id, is_primary from public.guardian_links where guardian_id = ${gina}`
    expect(links.map(describeLink).sort()).toEqual(['Gina -> Remy (primary)', 'Gina -> Sky (primary)'])
    expect(await peopleSeenBy('Gina')).toEqual(['Gina', 'Remy', 'Sky'])
  })

  // Checked on the rows as well as on the error, so a refusal of some other step cannot pass for this one.
  it('refuses a second current primary link for one sailor, and allows a second link that is not primary', async () => {
    expect((await link('Ola', 'Kit', true, null)).error).toBeNull()
    expect((await link('Pia', 'Kit', true, null)).error?.code).toBe('23505') // unique_violation
    expect((await link('Pia', 'Kit', false, null)).error).toBeNull()
    expect(await linksOf('Kit')).toEqual(['Ola -> Kit (primary)', 'Pia -> Kit'])
  })

  // The positive control for the one above: the primary rule counts current links only.
  it("allows a new primary link once the sailor's old primary link is unlinked", async () => {
    expect((await link('Ola', 'Kim', true, yesterday())).error).toBeNull()
    expect((await link('Pia', 'Kim', true, null)).error).toBeNull()
    expect(await linksOf('Kim')).toEqual(['Ola -> Kim (primary) unlinked', 'Pia -> Kim (primary)'])
  })
})

describe("a coach reads the current guardian links of their roster's sailors (#53)", () => {
  it("lets a JRT coach read the current links of JRT's sailors, and not an unlinked one or LTS's", async () => {
    expect(await linksSeenBy('Jordan')).toEqual([
      'Fran -> Sky',
      'Gina -> Remy (primary)',
      'Gina -> Sky (primary)',
    ])
  })

  it("lets an LTS coach read LTS's links and none of JRT's", async () => {
    expect(await linksSeenBy('Lee')).toEqual(['Hugo -> Theo (primary)'])
  })
})

describe('no client reads unlinked_at or writes a guardian link (#53)', () => {
  /** Every write privilege `role` holds on guardian_links. A grant on one column counts. */
  async function writes(role: string): Promise<string[]> {
    const rows = await sql<{ held: string }[]>`
      select p.privilege as held
      from unnest(array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) as p(privilege)
      where case
        when p.privilege in ('INSERT', 'UPDATE')
          then has_any_column_privilege(${role}, 'public.guardian_links'::regclass, p.privilege)
        else has_table_privilege(${role}, 'public.guardian_links'::regclass, p.privilege)
      end`
    return rows.map((row) => row.held).sort()
  }

  it('grants authenticated select on guardian_id, sailor_id and is_primary, and not unlinked_at', async () => {
    const rows = await sql<{ column: string }[]>`
      select a.attname as column
      from pg_attribute a
      where a.attrelid = 'public.guardian_links'::regclass
        and a.attnum > 0
        and not a.attisdropped
        and has_column_privilege('authenticated', a.attrelid, a.attnum, 'SELECT')
      order by a.attnum`
    expect(rows.map((row) => row.column)).toEqual(['guardian_id', 'sailor_id', 'is_primary'])
  })

  it('gives anon and authenticated no write on guardian_links', async () => {
    expect({ anon: await writes('anon'), authenticated: await writes('authenticated') }).toEqual({
      anon: [],
      authenticated: [],
    })
  })

  // The positive control: the same query sees the writes the server side holds.
  it('sees the writes service_role holds, with the same query', async () => {
    expect(await writes('service_role')).toEqual(['DELETE', 'INSERT', 'UPDATE'])
  })

  it("refuses a coach's select of unlinked_at", async () => {
    const coach = await signedIn('Jordan')
    const { error } = await coach.from('guardian_links').select('guardian_id, unlinked_at')
    expect(error?.code).toBe('42501')
  })

  // Checked on the rows, not on the error, so a refusal of some other step cannot pass for this one.
  // Neither write asks for the row back, so no read policy can be what refuses it.
  it('leaves the links unchanged when a guardian adds one and a coach edits one', async () => {
    const guardian = await signedIn('Gina')
    const added = await guardian
      .from('guardian_links')
      .insert({ guardian_id: personIds.get('Gina'), sailor_id: personIds.get('Theo') })
    const coach = await signedIn('Jordan')
    const edited = await coach
      .from('guardian_links')
      .update({ is_primary: true })
      .eq('guardian_id', personIds.get('Fran'))
      .eq('sailor_id', personIds.get('Sky'))
    expect([added.error?.code, edited.error?.code]).toEqual(['42501', '42501'])
    expect({ theo: await linksOf('Theo'), sky: await linksOf('Sky') }).toEqual({
      theo: ['Hugo -> Theo (primary)'],
      sky: ['Fran -> Sky', 'Gina -> Sky (primary)', 'Uma -> Sky unlinked'],
    })
  })
})

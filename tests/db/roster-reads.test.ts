// Roster reads follow program and season (#43). A signed-in coach or director reads the people,
// memberships, seasons and programs of each program in which they coach or direct a current season,
// limited to that program's current seasons. A coach of another program, last season's coach, and a
// sailor or treasurer of the same program read nothing (D46). No client writes any of it, and no
// client reads or writes people.auth_user_id.
//
// Its prove-tests mutation is tests/mutations/roster-ignores-program.sql, applied in CI by running
// the workflow by hand with `mutation: roster-ignores-program`. That file names the cases it is
// predicted to turn red.
//
// Like medical-access.test.ts, it needs a local Supabase and its credentials in the environment
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
// For the club's date, and for reading grants from the catalog as `postgres`.
const sql = postgres(env('DB_URL'), { max: 1, onnotice: () => {} })
afterAll(() => sql.end())

const noSession = { auth: { persistSession: false, autoRefreshToken: false } }
const admin = createClient(url, serviceKey, noSession)

// Unique per run, so reruns against the same local database never collide. Every person here is
// invented, and each has this run's id as their last name.
const run = randomUUID().slice(0, 8)
const password = `pw-${randomUUID()}`

// Who signs in, and the one membership each holds.
const SIGNS_IN = {
  Jordan: { program: 'JRT', season: 'Spring', role: 'coach' },
  Dana: { program: 'JRT', season: 'Spring', role: 'director' },
  Lee: { program: 'LTS', season: 'Spring', role: 'coach' },
  Pat: { program: 'JRT', season: 'Fall', role: 'coach' }, // last season's JRT coach
  Sam: { program: 'JRT', season: 'Spring', role: 'sailor' }, // a sailor aged 13 or over
  Terry: { program: 'JRT', season: 'Spring', role: 'treasurer' },
} as const
type Caller = keyof typeof SIGNS_IN

// Sailors who never sign in, with every season each sails in.
const SAILORS: Record<string, Array<[string, string]>> = {
  Maya: [
    ['JRT', 'Spring'],
    ['JRT', 'Fall'],
  ],
  Zoe: [['JRT', 'Regatta']], // a second JRT season, current at the same time as Spring
  Ava: [['JRT', 'Fall']], // last season only
  Liam: [['JRT', 'Summer']], // next season only
  Noah: [['LTS', 'Spring']],
}

// Each season as days from today in club time, both ends inclusive.
const SEASONS: Array<[string, string, number, number]> = [
  ['JRT', 'Spring', -30, 30],
  ['JRT', 'Regatta', -2, 2],
  ['JRT', 'Fall', -120, -1], // ended yesterday
  ['JRT', 'Summer', 1, 90], // starts tomorrow
  ['LTS', 'Spring', -30, 30],
]

const programIds = new Map<string, string>() // 'JRT' -> id
const seasonIds = new Map<string, string>() // 'JRT Spring' -> id
const personIds = new Map<string, string>() // 'Maya' -> id
let today = ''

async function insertOne(table: string, row: Record<string, unknown>): Promise<string> {
  const { data, error } = await admin.from(table).insert(row).select('id').single()
  if (error) throw new Error(`insert into ${table}: ${error.message}`)
  const id = (data as { id?: string }).id
  if (!id) throw new Error(`insert into ${table} came back without an id`)
  return id
}

async function insertMembership(person: string, program: string, season: string, role: string) {
  const { error } = await admin.from('memberships').insert({
    person_id: personIds.get(person),
    program_id: programIds.get(program),
    season_id: seasonIds.get(`${program} ${season}`),
    role,
  })
  if (error) throw new Error(`insert membership for ${person}: ${error.message}`)
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

/** Reverse lookups, so a row from another run or another program shows up by id, never hidden. */
function nameOf(map: Map<string, string>, id: string): string {
  for (const [name, value] of map) if (value === id) return name
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

beforeAll(async () => {
  today = await clubDay(0)
  for (const program of ['JRT', 'LTS']) {
    programIds.set(program, await insertOne('programs', { name: `${program} ${run}` }))
  }
  for (const [program, season, startsIn, endsIn] of SEASONS) {
    const id = await insertOne('seasons', {
      program_id: programIds.get(program),
      name: `${season} ${run}`,
      starts_on: await clubDay(startsIn),
      ends_on: await clubDay(endsIn),
    })
    seasonIds.set(`${program} ${season}`, id)
  }
  for (const [caller, { program, season, role }] of Object.entries(SIGNS_IN)) {
    const { data, error } = await admin.auth.admin.createUser({
      email: emailOf(caller as Caller),
      password,
      email_confirm: true,
    })
    if (error) throw new Error(`create user ${caller}: ${error.message}`)
    personIds.set(
      caller,
      await insertOne('people', { auth_user_id: data.user.id, first_name: caller, last_name: run }),
    )
    await insertMembership(caller, program, season, role)
  }
  for (const [sailor, seasons] of Object.entries(SAILORS)) {
    personIds.set(sailor, await insertOne('people', { first_name: sailor, last_name: run }))
    for (const [program, season] of seasons) await insertMembership(sailor, program, season, 'sailor')
  }
})

// JRT's current members: Spring (Jordan, Dana, Sam, Terry, Maya) and Regatta (Zoe). Not Pat, Ava or
// Maya's Fall membership (last season), not Liam (next season), not Lee or Noah (LTS).
const JRT_NOW = ['Dana', 'Jordan', 'Maya', 'Sam', 'Terry', 'Zoe']

describe('roster reads follow program and current season (#43)', () => {
  // The positive control: without it, a policy that returned nothing would pass every refusal below.
  it("lets a JRT coach read JRT's current members and no one else", async () => {
    expect(await peopleSeenBy('Jordan')).toEqual(JRT_NOW)
  })

  it("lets an LTS coach read LTS's current members and none of JRT's", async () => {
    expect(await peopleSeenBy('Lee')).toEqual(['Lee', 'Noah'])
  })

  it('lets a JRT director read the same as a JRT coach (D46)', async () => {
    expect(await peopleSeenBy('Dana')).toEqual(JRT_NOW)
  })

  it("lets last season's JRT coach, with no current membership, read no one", async () => {
    expect(await peopleSeenBy('Pat')).toEqual([])
    expect(await clubDay(0), 'the club date turned over during the test: run it again').toBe(today)
  })

  // Pat's season ended yesterday, so the refusal above rests on the dates. These two rest on the role:
  // each holds a current JRT Spring membership, the same as Jordan's.
  it('lets a JRT sailor who signs in read no one: roster reads are keyed on role (D46)', async () => {
    expect(await peopleSeenBy('Sam')).toEqual([])
  })

  it('lets a JRT treasurer read no one (D46)', async () => {
    expect(await peopleSeenBy('Terry')).toEqual([])
  })

  // The memberships policy calls a function that reads memberships. Run as the caller, that read
  // would re-enter the policy, and Postgres refuses it as infinite recursion (42P17).
  it("reads a JRT coach's memberships without RLS recursion, current seasons only", async () => {
    const coach = await signedIn('Jordan')
    const { data, error } = await coach.from('memberships').select('person_id, program_id, role, season_id')
    expect(error).toBeNull()
    const seen = (data ?? [])
      .map((row) => `${nameOf(personIds, row.person_id)} ${row.role} ${nameOf(seasonIds, row.season_id)}`)
      .sort()
    expect(seen).toEqual([
      'Dana director JRT Spring',
      'Jordan coach JRT Spring',
      'Maya sailor JRT Spring',
      'Sam sailor JRT Spring',
      'Terry treasurer JRT Spring',
      'Zoe sailor JRT Regatta',
    ])
  })

  it("lets a JRT coach read JRT's current seasons and its program, and no other", async () => {
    const coach = await signedIn('Jordan')
    const seasons = await coach.from('seasons').select('id, program_id, name, starts_on, ends_on')
    const programs = await coach.from('programs').select('id, name')
    expect(seasons.error).toBeNull()
    expect(programs.error).toBeNull()
    expect({
      seasons: (seasons.data ?? []).map((row) => nameOf(seasonIds, row.id)).sort(),
      programs: (programs.data ?? []).map((row) => nameOf(programIds, row.id)).sort(),
    }).toEqual({ seasons: ['JRT Regatta', 'JRT Spring'], programs: ['JRT'] })
  })
})

describe('no client reads auth_user_id or writes the roster (#43)', () => {
  const ROSTER_TABLES = ['people', 'memberships', 'seasons', 'programs']

  /** The columns of `table` that `role` may select, directly, through a role or through PUBLIC. */
  async function selectableColumns(role: string, table: string): Promise<string[]> {
    const rows = await sql<{ column: string }[]>`
      select a.attname as column
      from pg_attribute a
      where a.attrelid = ${`public.${table}`}::regclass
        and a.attnum > 0
        and not a.attisdropped
        and has_column_privilege(${role}, a.attrelid, a.attnum, 'SELECT')
      order by a.attnum`
    return rows.map((row) => row.column)
  }

  /** Every write privilege `role` holds on the roster tables. A grant on one column counts. */
  async function writes(role: string): Promise<string[]> {
    const rows = await sql<{ held: string }[]>`
      select format('%s %s', t.name, p.privilege) as held
      from unnest(${sql.array(ROSTER_TABLES)}::text[]) as t(name)
      cross join unnest(array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) as p(privilege)
      where case
        when p.privilege in ('INSERT', 'UPDATE')
          then has_any_column_privilege(${role}, ('public.' || t.name)::regclass, p.privilege)
        else has_table_privilege(${role}, ('public.' || t.name)::regclass, p.privilege)
      end`
    return rows.map((row) => row.held).sort()
  }

  it('grants authenticated select on exactly the roster columns, and on people only id and names', async () => {
    const granted: Record<string, string[]> = {}
    for (const table of ROSTER_TABLES) granted[table] = await selectableColumns('authenticated', table)
    expect(granted).toEqual({
      people: ['id', 'first_name', 'last_name'],
      memberships: ['person_id', 'program_id', 'role', 'season_id'],
      seasons: ['id', 'program_id', 'name', 'starts_on', 'ends_on'],
      programs: ['id', 'name'],
    })
  })

  it('lets no client select, insert, update or reference people.auth_user_id', async () => {
    const [row] = await sql<{ held: string[] }[]>`
      select array(
        select format('%s %s', r.role, p.privilege)
        from unnest(array['anon', 'authenticated']) as r(role)
        cross join unnest(array['SELECT', 'INSERT', 'UPDATE', 'REFERENCES']) as p(privilege)
        where has_column_privilege(r.role, 'public.people'::regclass, 'auth_user_id', p.privilege)
      ) as held`
    expect(row?.held).toEqual([])
  })

  it('gives anon and authenticated no write on people, memberships, seasons or programs', async () => {
    expect({ anon: await writes('anon'), authenticated: await writes('authenticated') }).toEqual({
      anon: [],
      authenticated: [],
    })
  })

  // The positive control: the same query sees the writes the server side holds.
  it('sees the writes service_role holds, with the same query', async () => {
    expect(await writes('service_role')).toEqual(
      ROSTER_TABLES.flatMap((table) => ['DELETE', 'INSERT', 'UPDATE'].map((p) => `${table} ${p}`)).sort(),
    )
  })

  it("refuses a coach's select of auth_user_id, and of every column with *", async () => {
    const coach = await signedIn('Jordan')
    const named = await coach.from('people').select('id, auth_user_id')
    const star = await coach.from('people').select('*')
    expect([named.error?.code, star.error?.code]).toEqual(['42501', '42501'])
  })

  // Checked on the row, not on the error, so a refusal of some other step cannot pass for this one.
  it("leaves a person's row unchanged when a coach of their program tries to update it", async () => {
    const coach = await signedIn('Jordan')
    const maya = personIds.get('Maya')
    const { error } = await coach.from('people').update({ first_name: 'Changed' }).eq('id', maya)
    expect(error?.code).toBe('42501')
    const [row] = await sql<
      { first_name: string }[]
    >`select first_name from public.people where id = ${maya ?? ''}`
    expect(row?.first_name).toBe('Maya')
  })
})

// The bootstrap command (#63) against a local Supabase. One run creates a program, its dated season,
// the director's people row, their confirmed account through the admit function, and a director
// membership of the season, and prints the four ids and nothing else. The same arguments again
// change nothing. A run that stopped part-way is finished by the next, and an existing row that
// disagrees with the arguments stops the command before it writes anything.
//
// "Current" is checked the way the app will check it: the director signs in by link and reads their
// own program's roster, which the roster policies (#43) show only while the season is current in club
// time. Rows are read back over a direct connection, auth.users included.
//
// It runs the command as `npm run bootstrap:program` runs it, with SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY set from this stack's API_URL and SERVICE_ROLE_KEY. Its refusals at start
// (no key, bad arguments) are tests/unit/bootstrap-program.test.ts, which needs no database.
//
// Like the other files here, it needs a local Supabase and its credentials in the environment
// (`npx supabase status -o env`), and fails rather than skipping without them.
import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
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
const sql = postgres(env('DB_URL'), { max: 1, onnotice: () => {} })
afterAll(() => sql.end())

const noSession = { auth: { persistSession: false, autoRefreshToken: false } }
const admin = createClient(url, serviceKey, noSession)

// The npm script is `node <file>`, read from package.json, so this runs what npm would run.
const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> }
const script = /^node (\S+)$/.exec(packageJson.scripts['bootstrap:program'] ?? '')?.[1]

// Unique per run, so reruns against the same local database never collide. Every person and program
// here is invented, and each carries this run's id.
const run = randomUUID().slice(0, 8)
const emailOf = (name: string) => `${name.toLowerCase()}-${run}@example.test`

interface Bootstrap {
  program: string
  season: string
  starts: string
  ends: string
  first: string
  last: string
  email: string
}

interface Run {
  code: number | null
  stdout: string
  stderr: string
}

function bootstrap(args: Bootstrap): Promise<Run> {
  if (!script) throw new Error('package.json has no `bootstrap:program` script of the form `node <file>`')
  const flags = Object.entries(args).flatMap(([flag, value]) => [`--${flag}`, value])
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [script, ...flags],
      { env: { ...process.env, SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: serviceKey } },
      (error, stdout, stderr) => {
        const code = error ? (typeof error.code === 'number' ? error.code : null) : 0
        resolve({ code, stdout, stderr })
      },
    )
  })
}

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const PRINTED = new RegExp(
  `^program_id=(${UUID})\\nseason_id=(${UUID})\\nperson_id=(${UUID})\\nauth_user_id=(${UUID})\\n$`,
)

interface Ids {
  programId: string
  seasonId: string
  personId: string
  authUserId: string
}

/** The four ids a successful run printed, or a failure showing what it printed instead. Nothing else
 * may be on stdout, so a name or an email printed there fails this. */
function printedIds(result: Run): Ids {
  const match = PRINTED.exec(result.stdout)
  if (result.code !== 0 || !match) {
    throw new Error(`bootstrap exited ${result.code}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`)
  }
  const [, programId = '', seasonId = '', personId = '', authUserId = ''] = match
  return { programId, seasonId, personId, authUserId }
}

/** How many of each row the program and the email have, so a duplicate shows as a 2. */
async function countsFor(program: string, email: string) {
  const [row] = await sql<
    { programs: number; seasons: number; people: number; accounts: number; memberships: number }[]
  >`
    select
      (select count(*)::int from public.programs where name = ${program}) as programs,
      (select count(*)::int from public.seasons s join public.programs p on p.id = s.program_id
        where p.name = ${program}) as seasons,
      (select count(*)::int from public.people where email = ${email}) as people,
      (select count(*)::int from auth.users where lower(email) = ${email}) as accounts,
      (select count(*)::int from public.memberships m join public.people pe on pe.id = m.person_id
        where pe.email = ${email}) as memberships`
  return row
}

/** A season around club today, so the director's membership is current. */
async function currentSeason(): Promise<{ starts: string; ends: string }> {
  const [row] = await sql<{ starts: string; ends: string }[]>`
    select (public.club_today() - 30)::text as starts, (public.club_today() + 30)::text as ends`
  if (!row) throw new Error('no club date')
  return row
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

describe('one command creates a program, its season and its director (#63)', () => {
  let args: Bootstrap
  let first: Run
  let ids: Ids

  beforeAll(async () => {
    args = {
      program: `Invented Program ${run}`,
      season: 'Spring',
      ...(await currentSeason()),
      first: 'Dana',
      last: run,
      email: emailOf('Dana'),
    }
    first = await bootstrap(args)
    ids = printedIds(first)
  })

  it('creates every row, links the account, and prints the four ids only', async () => {
    const [program] = await sql<{ name: string; test: boolean }[]>`
      select name,
        -- #73 adds programs.is_test. Until then no column can mark a test program, and once it
        -- lands this reads it, so a bootstrap program made a test one fails here.
        coalesce((to_jsonb(p) ->> 'is_test')::boolean, false) as test
      from public.programs p where id = ${ids.programId}`
    const [season] = await sql<{ program_id: string; name: string; starts_on: string; ends_on: string }[]>`
      select program_id::text, name, starts_on::text, ends_on::text from public.seasons where id = ${ids.seasonId}`
    const [person] = await sql<
      { first_name: string; last_name: string; email: string; auth_user_id: string }[]
    >`
      select first_name, last_name, email, auth_user_id::text from public.people where id = ${ids.personId}`
    const accounts = await sql<{ id: string; confirmed: boolean }[]>`
      select id::text, email_confirmed_at is not null as confirmed from auth.users where lower(email) = ${args.email}`
    const memberships = await sql<{ program_id: string; role: string; season_id: string }[]>`
      select program_id::text, role::text, season_id::text from public.memberships where person_id = ${ids.personId}`

    expect({ stderr: first.stderr, program, season, person, accounts, memberships }).toEqual({
      stderr: '',
      program: { name: args.program, test: false },
      season: { program_id: ids.programId, name: 'Spring', starts_on: args.starts, ends_on: args.ends },
      person: { first_name: 'Dana', last_name: run, email: args.email, auth_user_id: ids.authUserId },
      accounts: [{ id: ids.authUserId, confirmed: true }],
      memberships: [{ program_id: ids.programId, role: 'director', season_id: ids.seasonId }],
    })
  })

  // The roster policies (#43) admit a director only while their season is current in club time, so
  // reading their own program back is the proof the membership is a current one.
  it('lets the director sign in and read their program and its current season', async () => {
    const director = await signedInByLink(args.email)
    const [me, programs, seasons, memberships] = await Promise.all([
      director.from('me').select('id'),
      director.from('programs').select('id, name'),
      director.from('seasons').select('id, name'),
      director.from('memberships').select('person_id, program_id, role, season_id'),
    ])
    expect({
      me: me.data,
      programs: programs.data,
      seasons: seasons.data,
      memberships: memberships.data,
    }).toEqual({
      me: [{ id: ids.personId }],
      programs: [{ id: ids.programId, name: args.program }],
      seasons: [{ id: ids.seasonId, name: 'Spring' }],
      memberships: [
        { person_id: ids.personId, program_id: ids.programId, role: 'director', season_id: ids.seasonId },
      ],
    })
  })

  it('duplicates nothing when run again with the same arguments', async () => {
    const before = await countsFor(args.program, args.email)
    const again = await bootstrap(args)
    expect({ again, before, after: await countsFor(args.program, args.email) }).toEqual({
      again: { code: 0, stdout: first.stdout, stderr: '' },
      before: { programs: 1, seasons: 1, people: 1, accounts: 1, memberships: 1 },
      after: { programs: 1, seasons: 1, people: 1, accounts: 1, memberships: 1 },
    })
  })
})

describe('the bootstrap command finishes a run that stopped part-way (#63)', () => {
  // What a first run leaves when the admit function was down: the program and the person, and no
  // season, account or membership.
  it('adopts the rows already there and creates only the missing ones', async () => {
    const args: Bootstrap = {
      program: `Interrupted Program ${run}`,
      season: 'Spring',
      ...(await currentSeason()),
      first: 'Robin',
      last: run,
      email: emailOf('Robin'),
    }
    const [program] = await sql<{ id: string }[]>`
      insert into public.programs (name) values (${args.program}) returning id::text`
    const [person] = await sql<{ id: string }[]>`
      insert into public.people (first_name, last_name, email)
      values (${args.first}, ${args.last}, ${args.email}) returning id::text`

    const ids = printedIds(await bootstrap(args))
    expect({ ids, counts: await countsFor(args.program, args.email) }).toEqual({
      ids: {
        programId: program?.id,
        seasonId: ids.seasonId,
        personId: person?.id,
        authUserId: ids.authUserId,
      },
      counts: { programs: 1, seasons: 1, people: 1, accounts: 1, memberships: 1 },
    })
  })
})

describe('the bootstrap command refuses a disagreeing row before it writes anything (#63)', () => {
  let existing: Bootstrap

  beforeAll(async () => {
    existing = {
      program: `Existing Program ${run}`,
      season: 'Spring',
      ...(await currentSeason()),
      first: 'Sky',
      last: run,
      email: emailOf('Sky'),
    }
    printedIds(await bootstrap(existing))
  })

  // Each date on its own, so each comparison is the only one that can refuse. A new director rides
  // with the clash, so a write made before the refusal would show as their row.
  it.each([
    ['starts', '2000-01-01', 'starts on'],
    ['ends', '2099-12-31', 'ends on'],
  ] as const)(
    'refuses a season of that name whose --%s differs, and writes no new director',
    async (flag, value, says) => {
      const newcomer = emailOf(`Newcomer-${flag}`)
      const result = await bootstrap({ ...existing, [flag]: value, first: 'Newcomer', email: newcomer })
      const [season] = await sql<{ starts_on: string; ends_on: string }[]>`
      select s.starts_on::text, s.ends_on::text from public.seasons s
      join public.programs p on p.id = s.program_id where p.name = ${existing.program}`
      expect({
        code: result.code,
        stdout: result.stdout,
        season,
        newcomer: await countsFor(existing.program, newcomer),
      }).toEqual({
        code: 1,
        stdout: '',
        season: { starts_on: existing.starts, ends_on: existing.ends },
        newcomer: { programs: 1, seasons: 1, people: 0, accounts: 0, memberships: 0 },
      })
      expect(result.stderr).toContain(`season "Spring" of "${existing.program}" ${says} ${existing[flag]}`)
    },
  )

  // Each name on its own, as above. A new program rides with the clash, so a write made before the
  // refusal would show as that program.
  it.each([
    ['first', 'Skye', 'first name'],
    ['last', 'Otherwise', 'last name'],
  ] as const)(
    'refuses an existing email under another %s name, printing neither name',
    async (flag, value, says) => {
      const program = `Other Program ${flag} ${run}`
      const result = await bootstrap({ ...existing, program, [flag]: value })
      const [person] = await sql<{ first_name: string; last_name: string }[]>`
      select first_name, last_name from public.people where email = ${existing.email}`
      expect({
        code: result.code,
        stdout: result.stdout,
        person,
        program: (await countsFor(program, existing.email))?.programs,
        named: [existing.first, existing.last, value].filter((name) => result.stderr.includes(name)),
      }).toEqual({
        code: 1,
        stdout: '',
        person: { first_name: existing.first, last_name: existing.last },
        program: 0,
        named: [],
      })
      expect(result.stderr).toContain(`the person with this email has a different ${says}`)
    },
  )
})

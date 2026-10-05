// Bootstrap a program (#63, E3, D15): one command creates a program, its first dated season and its
// director, so live setup is repeatable and never hand-typed SQL. Every director screen needs a
// director membership and every membership needs a season, and with sign-ups off (D15) nothing else
// can create the first director on live. #75 runs this there.
//
//   npm run bootstrap:program -- --program "<name>" --season "<name>" --starts YYYY-MM-DD
//     --ends YYYY-MM-DD --first <first name> --last <last name> --email <address>
//
// It reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the environment, never from a file, and
// stops before any request when either is unset or blank. The key is the legacy service-role JWT,
// `SERVICE_ROLE_KEY` in `npx supabase status -o env`: the admit function compares its caller's key
// with that one and refuses any other (#59).
//
// It reads what already exists first, and refuses before any write when an existing row disagrees
// with the arguments: a season of that name with other dates, or a person with that email under
// another name. Then it creates whatever is missing, in order: the program, its season, the
// director's people row, their account through the admit Edge Function (the one way an account comes
// to exist, #59), and their director membership of the season. It prints ids only, never a name or
// an email.
//
// Safe to repeat. Each step finds its row before creating one, so the same arguments again change
// nothing, and a run that stopped part-way is finished by the next. The steps are separate API calls
// with no transaction across them, which is why each one has to be.
//
// The program is a real one. Invented test programs are #73's, which marks them programs.is_test;
// nothing here sets that column.
//
// A failure sets process.exitCode and returns. It never calls process.exit(): on Windows, exiting
// straight after a fetch to a remote host aborts in libuv and replaces the exit code (cairn memory,
// node-process-exit-after-fetch).
import { parseArgs } from 'node:util'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const ENV_NAMES = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const
type EnvName = (typeof ENV_NAMES)[number]
type Env = Readonly<Record<EnvName, string>>

const USAGE = `usage: npm run bootstrap:program -- --program <name> --season <name> --starts YYYY-MM-DD
  --ends YYYY-MM-DD --first <first name> --last <last name> --email <address>`

// admission.ts's test, so the command refuses up front what the admit function would refuse later.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DATE = /^\d{4}-\d{2}-\d{2}$/

interface Arguments {
  program: string
  season: string
  startsOn: string
  endsOn: string
  firstName: string
  lastName: string
  email: string
}

interface Ids {
  programId: string
  seasonId: string
  personId: string
  authUserId: string
}

/** A refusal at start: nothing was requested, so the usage line may help. */
class StartRefusal extends Error {}

/** Reads each named variable, or refuses naming every one that is unset or blank (as env.ts does). */
function loadEnv(): Env {
  const env: Partial<Record<EnvName, string>> = {}
  const missing: EnvName[] = []
  for (const name of ENV_NAMES) {
    const value = process.env[name]
    if (value === undefined || value.trim() === '') missing.push(name)
    else env[name] = value.trim()
  }
  if (missing.length > 0) {
    throw new StartRefusal(`Missing required environment variable(s): ${missing.join(', ')}.`)
  }
  return env as Env
}

function readArguments(argv: string[]): Arguments {
  let values: Record<string, string | undefined>
  try {
    values = parseArgs({
      args: argv,
      strict: true,
      allowPositionals: false,
      options: {
        program: { type: 'string' },
        season: { type: 'string' },
        starts: { type: 'string' },
        ends: { type: 'string' },
        first: { type: 'string' },
        last: { type: 'string' },
        email: { type: 'string' },
      },
    }).values
  } catch (error) {
    throw new StartRefusal(error instanceof Error ? error.message : String(error))
  }

  const flags = ['program', 'season', 'starts', 'ends', 'first', 'last', 'email'] as const
  const missing = flags.filter((flag) => (values[flag] ?? '').trim() === '')
  if (missing.length > 0) throw new StartRefusal(`Missing ${missing.map((flag) => `--${flag}`).join(', ')}.`)
  const given = (flag: (typeof flags)[number]) => (values[flag] ?? '').trim()

  const startsOn = given('starts')
  const endsOn = given('ends')
  for (const [flag, value] of [
    ['--starts', startsOn],
    ['--ends', endsOn],
  ] as const) {
    if (!isDate(value)) throw new StartRefusal(`${flag} must be a date written YYYY-MM-DD.`)
  }
  // Both dates are inclusive, as in seasons_ends_on_or_after_starts_on, so one day is a season.
  if (endsOn < startsOn) throw new StartRefusal('--ends must be on or after --starts.')

  // Stored the way people_email_normalised requires and Auth compares it.
  const email = given('email').toLowerCase()
  if (!EMAIL.test(email)) throw new StartRefusal('--email must be an email address.')

  return {
    program: given('program'),
    season: given('season'),
    startsOn,
    endsOn,
    firstName: given('first'),
    lastName: given('last'),
    email,
  }
}

/** A real calendar date written YYYY-MM-DD: 2027-02-30 has the shape and is refused. */
function isDate(value: string): boolean {
  if (!DATE.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

interface QueryResult {
  data: unknown
  error: { message: string } | null
}

/** The rows a read returned, or a failure naming what was being read. */
async function rows<Row>(query: PromiseLike<QueryResult>, what: string): Promise<Row[]> {
  const { data, error } = await query
  if (error) throw new Error(`${what}: ${error.message}`)
  return data as Row[]
}

/** The id of the one row an insert returned. */
async function insertedId(query: PromiseLike<QueryResult>, what: string): Promise<string> {
  const [row] = await rows<{ id: string }>(query, what)
  if (!row) throw new Error(`${what}: no row came back`)
  return row.id
}

async function bootstrap(env: Env, args: Arguments): Promise<Ids> {
  const db: SupabaseClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // 1. What already exists. Program names are unique, a season's name is unique in its program, and
  // an email is unique among people, so each read finds at most one row.
  const [program] = await rows<{ id: string }>(
    db.from('programs').select('id').eq('name', args.program),
    'read the program',
  )
  const [season] = program
    ? await rows<{ id: string; starts_on: string; ends_on: string }>(
        db
          .from('seasons')
          .select('id, starts_on, ends_on')
          .eq('program_id', program.id)
          .eq('name', args.season),
        'read the season',
      )
    : []
  const [person] = await rows<{ id: string; first_name: string; last_name: string }>(
    db.from('people').select('id, first_name, last_name').eq('email', args.email),
    'read the director',
  )

  // 2. Refuse before any write when an existing row disagrees. A season's dates decide when its
  // members' access ends, and a mistyped name may mean the wrong person, so neither is changed here
  // and neither is quietly ignored. The person's names are not printed: they are the person's.
  const disagreements: string[] = []
  if (season && season.starts_on !== args.startsOn) {
    disagreements.push(`season "${args.season}" of "${args.program}" starts on ${season.starts_on}`)
  }
  if (season && season.ends_on !== args.endsOn) {
    disagreements.push(`season "${args.season}" of "${args.program}" ends on ${season.ends_on}`)
  }
  if (person && person.first_name !== args.firstName) {
    disagreements.push('the person with this email has a different first name')
  }
  if (person && person.last_name !== args.lastName) {
    disagreements.push('the person with this email has a different last name')
  }
  if (disagreements.length > 0) {
    throw new Error(
      `Existing rows disagree with the arguments, so nothing was written:\n  ${disagreements.join('\n  ')}`,
    )
  }

  // 3. Create whatever is missing, in the order each row needs the one before it.
  const programId =
    program?.id ??
    (await insertedId(db.from('programs').insert({ name: args.program }).select('id'), 'create the program'))

  const seasonId =
    season?.id ??
    (await insertedId(
      db
        .from('seasons')
        .insert({ program_id: programId, name: args.season, starts_on: args.startsOn, ends_on: args.endsOn })
        .select('id'),
      'create the season',
    ))

  const personId =
    person?.id ??
    (await insertedId(
      db
        .from('people')
        .insert({ first_name: args.firstName, last_name: args.lastName, email: args.email })
        .select('id'),
      'create the director',
    ))

  const admittedId = await admit(env, args.email)
  if (admittedId !== personId) {
    throw new Error('admit the director: the admit function admitted a different person')
  }

  const director = { person_id: personId, program_id: programId, role: 'director', season_id: seasonId }
  const memberships = await rows<{ person_id: string }>(
    db.from('memberships').select('person_id').match(director),
    'read the membership',
  )
  if (memberships.length === 0) {
    const { error } = await db.from('memberships').insert(director)
    if (error) throw new Error(`create the membership: ${error.message}`)
  }

  const [linked] = await rows<{ auth_user_id: string | null }>(
    db.from('people').select('auth_user_id').eq('id', personId),
    'read the account link',
  )
  if (!linked?.auth_user_id) throw new Error('admit the director: the person has no account after admission')

  return { programId, seasonId, personId, authUserId: linked.auth_user_id }
}

/** Admits the director through the admit Edge Function, as the roster sync will, and returns the
 * id of the person it admitted. */
async function admit(env: Env, email: string): Promise<string> {
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  const response = await fetch(`${env.SUPABASE_URL.replace(/\/+$/, '')}/functions/v1/admit`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  const body = (await response.json().catch(() => null)) as { personId?: unknown; error?: unknown } | null
  if (response.status !== 200 || typeof body?.personId !== 'string') {
    const reason = typeof body?.error === 'string' ? `: ${body.error}` : ''
    throw new Error(`admit the director: the admit function answered ${response.status}${reason}`)
  }
  return body.personId
}

async function main(): Promise<void> {
  try {
    const env = loadEnv()
    const args = readArguments(process.argv.slice(2))
    const ids = await bootstrap(env, args)
    process.stdout.write(
      `program_id=${ids.programId}\nseason_id=${ids.seasonId}\nperson_id=${ids.personId}\n` +
        `auth_user_id=${ids.authUserId}\n`,
    )
  } catch (error) {
    process.stderr.write(`bootstrap:program: ${error instanceof Error ? error.message : String(error)}\n`)
    if (error instanceof StartRefusal) process.stderr.write(`${USAGE}\n`)
    process.exitCode = 1
  }
}

await main()

// The scaffold's one real test (ADR 009): a coach of another program is refused a sailor's
// medical card. It guards the charter's one bet (ADR 002), so it must be able to fail. The
// prove-tests mutation for it is tests/mutations/medical-ignores-program.sql, applied in CI by
// running the workflow by hand with `mutation: medical-ignores-program` (expected: exactly the
// "refuses a coach of another program" case turns red).
//
// Since #39 access also ends with the season. Its mutation is
// tests/mutations/medical-ignores-season-dates.sql (expected: exactly the "season ended yesterday"
// and "season starts tomorrow" cases turn red).
//
// It needs a local Supabase (`npx supabase start`, which needs Docker) and its credentials in the
// environment (`npx supabase status -o env`). With nothing set it fails loudly rather than skipping:
// a skipped test here would read as a pass.
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
// Read only for the club's date, so each season is dated by the same club_today() the access
// check calls.
const sql = postgres(env('DB_URL'), { max: 1, onnotice: () => {} })
afterAll(() => sql.end())

const noSession = { auth: { persistSession: false, autoRefreshToken: false } }
const admin = createClient(url, serviceKey, noSession)

// Unique per run, so reruns against the same local database never collide.
const run = randomUUID().slice(0, 8)
const password = `pw-${randomUUID()}`
const emails = {
  sameProgram: `coach-jrt-${run}@example.test`,
  otherProgram: `coach-lts-${run}@example.test`,
  lapsed: `coach-jrt-last-${run}@example.test`,
  upcoming: `coach-jrt-next-${run}@example.test`,
  oneDay: `coach-jrt-regatta-${run}@example.test`,
}
let sailorId = ''
let today = ''

async function insertOne(table: string, row: Record<string, unknown>): Promise<{ id?: string }> {
  const { data, error } = await admin.from(table).insert(row).select().single()
  if (error) throw new Error(`insert into ${table}: ${error.message}`)
  return data as { id?: string }
}

function idOf(row: { id?: string }): string {
  if (!row.id) throw new Error('inserted row came back without an id')
  return row.id
}

/** The club's date `days` from today, as club_today() counts it. */
async function clubDay(days: number): Promise<string> {
  const [row] = await sql<{ day: string }[]>`select (public.club_today() + ${days}::int)::text as day`
  if (!row) throw new Error('club_today() returned no row')
  return row.day
}

async function signedIn(email: string): Promise<SupabaseClient> {
  const client = createClient(url, anonKey, noSession)
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`sign in ${email}: ${error.message}`)
  return client
}

beforeAll(async () => {
  today = await clubDay(0)
  const jrt = idOf(await insertOne('programs', { name: `JRT ${run}` }))
  const lts = idOf(await insertOne('programs', { name: `LTS ${run}` }))

  async function season(programId: string, name: string, startsIn: number, endsIn: number) {
    const dates = { starts_on: await clubDay(startsIn), ends_on: await clubDay(endsIn) }
    return idOf(await insertOne('seasons', { program_id: programId, name: `${name} ${run}`, ...dates }))
  }
  const jrtNow = await season(jrt, 'Spring', -30, 30)
  const jrtLast = await season(jrt, 'Fall', -120, -1) // ended yesterday in club time
  const jrtNext = await season(jrt, 'Summer', 1, 90) // starts tomorrow in club time
  const jrtOneDay = await season(jrt, 'Regatta day', 0, 0) // starts and ends today
  const ltsNow = await season(lts, 'Spring', -30, 30)

  const coaches: Array<[string, string, string]> = [
    [emails.sameProgram, jrt, jrtNow],
    [emails.otherProgram, lts, ltsNow],
    [emails.lapsed, jrt, jrtLast],
    [emails.upcoming, jrt, jrtNext],
    [emails.oneDay, jrt, jrtOneDay],
  ]
  for (const [email, programId, seasonId] of coaches) {
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
    if (error) throw new Error(`create user ${email}: ${error.message}`)
    const coachId = idOf(
      await insertOne('people', { auth_user_id: data.user.id, first_name: 'Coach', last_name: run }),
    )
    await insertOne('memberships', {
      person_id: coachId,
      program_id: programId,
      role: 'coach',
      season_id: seasonId,
    })
  }

  sailorId = idOf(await insertOne('people', { first_name: 'Maya', last_name: run }))
  for (const seasonId of [jrtNow, jrtLast, jrtNext, jrtOneDay]) {
    await insertOne('memberships', {
      person_id: sailorId,
      program_id: jrt,
      role: 'sailor',
      season_id: seasonId,
    })
  }
  await insertOne('medical_flags', {
    sailor_id: sailorId,
    flags: ['Carries EpiPen'],
    action_note: 'EpiPen is in the blue dry bag in the coach boat.',
  })
})

describe('medical card access (ADR 002, ADR 009)', () => {
  // The positive control. Without it, a function that always answered false would pass the
  // refusals below for the wrong reason.
  it("lets a coach of the sailor's own program through", async () => {
    const coach = await signedIn(emails.sameProgram)
    const { data, error } = await coach.rpc('can_view_medical', { p_sailor: sailorId })
    expect(error).toBeNull()
    expect(data).toBe(true)
  })

  it('refuses a coach of another program', async () => {
    const coach = await signedIn(emails.otherProgram)
    const { data, error } = await coach.rpc('can_view_medical', { p_sailor: sailorId })
    expect(error).toBeNull()
    expect(data).toBe(false)
  })

  it('never serves the medical table to a signed-in client, even the right coach', async () => {
    const coach = await signedIn(emails.sameProgram)
    const { data, error } = await coach.from('medical_flags').select('*').eq('sailor_id', sailorId)
    expect(data).toBeNull()
    expect(error?.code).toBe('42501') // insufficient_privilege: the table is revoked, not merely empty
  })
})

// Each coach here shares a season with the sailor, in the sailor's own program, so only that
// season's dates can refuse them.
describe('medical card access ends with the season (#39)', () => {
  it('refuses a coach whose only season ended yesterday in club time', async () => {
    const coach = await signedIn(emails.lapsed)
    const { data, error } = await coach.rpc('can_view_medical', { p_sailor: sailorId })
    expect(error).toBeNull()
    expect(data).toBe(false)
  })

  it('refuses a coach whose only season starts tomorrow in club time', async () => {
    const coach = await signedIn(emails.upcoming)
    const { data, error } = await coach.rpc('can_view_medical', { p_sailor: sailorId })
    expect(error).toBeNull()
    expect(data).toBe(false)
  })

  // Both ends of the date range are inclusive: a season that starts and ends today is current.
  it('lets a coach through on a season that starts and ends today', async () => {
    const coach = await signedIn(emails.oneDay)
    const { data, error } = await coach.rpc('can_view_medical', { p_sailor: sailorId })
    expect(await clubDay(0), 'the club date turned over during the test: run it again').toBe(today)
    expect(error).toBeNull()
    expect(data).toBe(true)
  })
})

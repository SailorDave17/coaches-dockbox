// The scaffold's one real test (ADR 009): a coach of another program is refused a sailor's
// medical card. It guards the charter's one bet (ADR 002), so it must be able to fail. The
// prove-tests mutation for it is tests/mutations/medical-ignores-program.sql, applied in CI by
// running the workflow by hand with `mutation: medical-ignores-program` (expected: exactly the
// "refuses a coach of another program" case turns red).
//
// It needs a local Supabase (`npx supabase start`, which needs Docker) and its credentials in the
// environment (`npx supabase status -o env`). With nothing set it fails loudly rather than skipping:
// a skipped test here would read as a pass.
import { randomUUID } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, it } from 'vitest'

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

const noSession = { auth: { persistSession: false, autoRefreshToken: false } }
const admin = createClient(url, serviceKey, noSession)

// Unique per run, so reruns against the same local database never collide.
const run = randomUUID().slice(0, 8)
const password = `pw-${randomUUID()}`
const SEASON = '2027-spring'
const emails = {
  sameProgram: `coach-jrt-${run}@example.test`,
  otherProgram: `coach-lts-${run}@example.test`,
}
let sailorId = ''

async function insertOne(table: string, row: Record<string, unknown>): Promise<{ id?: string }> {
  const { data, error } = await admin.from(table).insert(row).select().single()
  if (error) throw new Error(`insert into ${table}: ${error.message}`)
  return data as { id?: string }
}

function idOf(row: { id?: string }): string {
  if (!row.id) throw new Error('inserted row came back without an id')
  return row.id
}

async function signedIn(email: string): Promise<SupabaseClient> {
  const client = createClient(url, anonKey, noSession)
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`sign in ${email}: ${error.message}`)
  return client
}

beforeAll(async () => {
  const jrt = idOf(await insertOne('programs', { name: `JRT ${run}` }))
  const lts = idOf(await insertOne('programs', { name: `LTS ${run}` }))

  const coaches: Array<[string, string]> = [
    [emails.sameProgram, jrt],
    [emails.otherProgram, lts],
  ]
  for (const [email, programId] of coaches) {
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
    if (error) throw new Error(`create user ${email}: ${error.message}`)
    const coachId = idOf(
      await insertOne('people', { auth_user_id: data.user.id, first_name: 'Coach', last_name: run }),
    )
    await insertOne('memberships', {
      person_id: coachId,
      program_id: programId,
      role: 'coach',
      season: SEASON,
    })
  }

  sailorId = idOf(await insertOne('people', { first_name: 'Maya', last_name: run }))
  await insertOne('memberships', { person_id: sailorId, program_id: jrt, role: 'sailor', season: SEASON })
  await insertOne('medical_flags', {
    sailor_id: sailorId,
    flags: ['Carries EpiPen'],
    action_note: 'EpiPen is in the blue dry bag in the coach boat.',
  })
})

describe('medical card access (ADR 002, ADR 009)', () => {
  // The positive control. Without it, a function that always answered false would pass the
  // refusal below for the wrong reason.
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

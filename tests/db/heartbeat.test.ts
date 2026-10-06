// The heartbeat Edge Function, called through the local gateway (#35, #41). It is a cron-driven job
// now, so the gateway checks no JWT for it (verify_jwt = false) and the function refuses any call
// without the cron secret. A 401 carrying the function's own body, not the gateway's, shows that
// edge-runtime is up, serves supabase/functions behind kong, and booted the function through the
// shared env loader, which throws at boot when a value is missing. The loader's own cases are Deno
// tests beside it: supabase/functions/_shared/env.test.ts. A run with the secret is followed from cron
// to the far end in scheduled-jobs.test.ts.
//
// Like the other files here, it needs a local Supabase and its credentials in the environment
// (`npx supabase status -o env`), and fails rather than skipping without them.
import { describe, expect, it } from 'vitest'

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
// The value exported before `npx supabase start`, which the edge runtime holds.
const cronSecret = env('CRON_SECRET')

async function call(headers: Record<string, string>): Promise<{ status: number; body: string }> {
  const response = await fetch(`${url}/functions/v1/heartbeat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ run: 1, job: 'heartbeat', window: '2040-01-01T00:00:00Z' }),
  })
  return { status: response.status, body: await response.text() }
}

const refused = { status: 401, body: JSON.stringify({ error: 'cron secret required' }) }

describe('the heartbeat Edge Function', () => {
  it('answers a call with no cron secret and no JWT with its own 401, so the gateway let it through', async () => {
    expect(await call({})).toEqual(refused)
  })

  it('answers the same to a call carrying the public key but a wrong cron secret', async () => {
    expect(
      await call({ apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'X-Cron-Secret': 'not-the-secret' }),
    ).toEqual(refused)
  })

  // The secret's own length with its last character changed, and the secret with one more after it:
  // a comparison that checked only the length, or only as far as the expected secret runs, would let
  // each through to the run lookup and answer 404 instead.
  it('answers the same to the right-length secret with one character changed, and to the secret with more after it', async () => {
    const changed = cronSecret.slice(0, -1) + (cronSecret.endsWith('0') ? '1' : '0')
    expect({
      changed: await call({ 'X-Cron-Secret': changed }),
      longer: await call({ 'X-Cron-Secret': `${cronSecret}0` }),
    }).toEqual({ changed: refused, longer: refused })
  })
})

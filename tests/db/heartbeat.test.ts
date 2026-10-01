// The heartbeat Edge Function, called through the local gateway (#35). A 200 carrying the function's
// own body shows edge-runtime is up, serves supabase/functions behind kong, and booted the function
// through the shared env loader, which throws at boot when a value is missing. The loader's own
// cases are Deno tests beside it: supabase/functions/_shared/env.test.ts.
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

describe('the heartbeat Edge Function', () => {
  it('answers 200 with its own body through the local gateway', async () => {
    const response = await fetch(`${url}/functions/v1/heartbeat`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
    })
    expect({ status: response.status, body: await response.text() }).toEqual({
      status: 200,
      body: JSON.stringify({ ok: true }),
    })
  })
})

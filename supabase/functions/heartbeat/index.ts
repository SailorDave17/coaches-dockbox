// The heartbeat (#35): the smallest function that starts the way every function here must, with
// its env loaded at module scope through the shared loader (ADR 011). SUPABASE_URL is one the
// platform sets for every function, locally and hosted, so a 200 through the gateway shows the
// loader ran under the edge runtime and found it. tests/db/heartbeat.test.ts makes that call.
import { loadEnv } from '../_shared/env.ts'

loadEnv(['SUPABASE_URL'])

Deno.serve(() => Response.json({ ok: true }))

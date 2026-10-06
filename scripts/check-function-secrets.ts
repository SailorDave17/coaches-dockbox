// The post-deploy secrets check (#41, D21(e)): does the live project hold every secret a cron-driven
// Edge Function's env loader requires? The deploy job runs it last, after the functions are deployed:
//
//   npm run check:secrets
//
// It reads SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF from the environment, and stops before any
// request when either is unset or blank. It lists the live project's function secrets through the
// Management API (GET /v1/projects/{ref}/secrets), prints their names, and fails naming each function
// and each name its loader requires that the list lacks. The list already holds the names the
// platform sets for every function, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY among them (measured
// 2026-10-05), so nothing is exempted. It prints names only: the list's values are digests, and none
// is printed either.
//
// What each function requires comes from supabase/functions/_shared/scheduled.ts, the same list the
// function's loader is given, so the two cannot disagree. A cron-driven function boots without a
// listed secret only to fail at boot, and pg_cron would then call it every window for nothing.
//
// SUPABASE_MANAGEMENT_API_URL replaces https://api.supabase.com, for the unit test's local server.
// A failure sets process.exitCode and returns, like the bootstrap command (scripts/bootstrap-program.ts).
import { SCHEDULED } from '../supabase/functions/_shared/scheduled.ts'

const ENV_NAMES = ['SUPABASE_ACCESS_TOKEN', 'SUPABASE_PROJECT_REF'] as const

function fail(message: string): void {
  console.error(message)
  process.exitCode = 1
}

async function main(): Promise<void> {
  const unset = ENV_NAMES.filter((name) => (process.env[name] ?? '').trim() === '')
  if (unset.length > 0) return fail(`Not set: ${unset.join(', ')}. Nothing was asked of the live project.`)
  const token = process.env.SUPABASE_ACCESS_TOKEN ?? ''
  const ref = process.env.SUPABASE_PROJECT_REF ?? ''
  const api = (process.env.SUPABASE_MANAGEMENT_API_URL ?? 'https://api.supabase.com').replace(/\/+$/, '')

  let response: Response
  try {
    response = await fetch(`${api}/v1/projects/${encodeURIComponent(ref)}/secrets`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15_000),
    })
  } catch (error) {
    return fail(`The Management API did not answer the secrets list: ${String(error)}`)
  }
  const body: unknown = await response.json().catch(() => undefined)
  if (!response.ok) {
    return fail(`The Management API answered the secrets list with ${response.status}, not 200.`)
  }
  const names: unknown[] = Array.isArray(body)
    ? body.map((secret: unknown) => (secret as { name?: unknown } | null)?.name)
    : []
  if (!Array.isArray(body) || !names.every((name) => typeof name === 'string')) {
    return fail('The Management API answered the secrets list with something other than a list of names.')
  }
  const live = new Set(names as string[])
  console.log(`Live function secrets: ${[...live].sort().join(', ') || 'none'}`)

  const problems: string[] = []
  for (const [job, names] of Object.entries(SCHEDULED)) {
    const missing = names.filter((name) => !live.has(name))
    if (missing.length === 0) console.log(`${job}: ${names.join(', ')}, all set`)
    else problems.push(`${job} requires ${missing.join(', ')}, which the live project does not hold`)
  }
  if (problems.length > 0) {
    fail(
      `${problems.join('. ')}. Set each one with \`supabase secrets set NAME=...\` on the live project ` +
        '(README, Scheduled jobs), then re-run this job.',
    )
  }
}

await main()

// The one way a cron-driven Edge Function serves (#41, ADR 011, D21(e)). pg_cron runs
// private.run_job (migration 20261005120000_scheduled_jobs.sql) on the job's schedule. For each window
// that is due, run_job claims a public.job_runs row and POSTs { run, job, window } here, with the cron
// secret in X-Cron-Secret. This answers:
//   401 the cron secret is missing or wrong      405 not a POST
//   400 the body is not a run of this job        404 no claimed run has this id, job and window
//   200 { ok: true, run }                         the work ran, and the run is recorded finished
//   200 { ok: true, run, duplicate: true }        the run was already finished, and nothing ran
//   500 { ok: false, run }                        the work threw, and the run is recorded failed
//   502                                           the run record could not be read or written
//
// The gateway does not check a JWT for these functions (verify_jwt = false in supabase/config.toml):
// pg_cron holds no user, so the cron secret is the only credential, and every request lacking it is
// refused here before anything is read.
//
// The finished run is written by this end, never by run_job, so a job_runs row with finished_at set
// is proof the function was reached and ran. run_job's claim is what makes a window run once. This end
// adds that a second delivery of a finished run does nothing, by two guards: the read says the run is
// finished, so the work is not run; and the write finishes only an unfinished run, so a delivery that
// lost a race to another finishes nothing. job.test.ts holds each one alone.
import { loadEnv } from './env.ts'
import { sameSecret } from './same-secret.ts'
import { SCHEDULED, type ScheduledJob } from './scheduled.ts'

/** A job's work for one window. What it returns is stored as the run's detail, so it must hold no
 * personal data: counts and ids, never a name, an email or a medical field. */
export type Work = (window: Date) => Promise<string | undefined>

/** A PostgREST call, path relative to /rest/v1/, made with the service role. */
export type Rest = (path: string, init?: RequestInit) => Promise<Response>

interface Call {
  run: number
  window: Date
}

interface RunRow {
  job: string
  window_start: string
  finished_at: string | null
}

// job_runs.detail's own limit (the migration's check).
export const DETAIL_LIMIT = 500

/** Loads the job's env at module scope, then serves its runs. Call it once, from the function's
 * index.ts, before anything else. */
export function serveJob(job: ScheduledJob, work: Work): void {
  const env = loadEnv(SCHEDULED[job])
  const rest: Rest = (path, init = {}) =>
    fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        ...init.headers,
      },
    })
  Deno.serve(jobHandler(job, work, { cronSecret: env.CRON_SECRET, rest }))
}

/** The request handler serveJob serves, given what it would load at boot. Exported for job.test.ts. */
export function jobHandler(
  job: ScheduledJob,
  work: Work,
  { cronSecret, rest }: { cronSecret: string; rest: Rest },
): (request: Request) => Promise<Response> {
  return async (request) => {
    if (request.method !== 'POST') return answer(405, { error: 'POST only' })
    if (!sameSecret(request.headers.get('X-Cron-Secret') ?? '', cronSecret)) {
      return answer(401, { error: 'cron secret required' })
    }
    const call = parseCall(await request.json().catch(() => null), job)
    if (!call) {
      return answer(400, { error: `expected { "run": number, "job": "${job}", "window": ISO time }` })
    }

    try {
      const found = await rest(`job_runs?id=eq.${call.run}&select=job,window_start,finished_at`)
      await expectOk(found, 'reading the run')
      const [row] = (await found.json()) as RunRow[]
      if (!row || row.job !== job || new Date(row.window_start).getTime() !== call.window.getTime()) {
        return answer(404, { error: 'no claimed run has this id, job and window' })
      }
      if (row.finished_at !== null) return answer(200, { ok: true, run: call.run, duplicate: true })

      let ok = true
      let detail: string | null = null
      try {
        detail = (await work(call.window)) ?? null
      } catch (error) {
        ok = false
        // The error's name only: its message may carry whatever the work was handling.
        detail = `the work threw ${error instanceof Error ? error.name : typeof error}`
        console.error(
          'scheduled job run failed:',
          job,
          call.run,
          error instanceof Error ? error.message : error,
        )
      }

      // finished_at=is.null: a delivery that lost a race with another finishes nothing.
      const finished = await rest(`job_runs?id=eq.${call.run}&finished_at=is.null&select=id`, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          finished_at: new Date().toISOString(),
          ok,
          detail: detail?.slice(0, DETAIL_LIMIT) ?? null,
        }),
      })
      await expectOk(finished, 'recording the run')
      if (((await finished.json()) as unknown[]).length === 0) {
        return answer(200, { ok: true, run: call.run, duplicate: true })
      }
      return answer(ok ? 200 : 500, { ok, run: call.run })
    } catch (error) {
      console.error(
        'scheduled job run record failed:',
        job,
        call.run,
        error instanceof Error ? error.message : error,
      )
      return answer(502, { error: 'the run record could not be read or written' })
    }
  }
}

function parseCall(body: unknown, job: ScheduledJob): Call | undefined {
  if (typeof body !== 'object' || body === null) return undefined
  const { run, job: named, window } = body as Record<string, unknown>
  if (!Number.isSafeInteger(run) || (run as number) <= 0 || named !== job || typeof window !== 'string') {
    return undefined
  }
  const at = new Date(window)
  return Number.isNaN(at.getTime()) ? undefined : { run: run as number, window: at }
}

async function expectOk(response: Response, what: string): Promise<void> {
  if (response.ok) return
  const body = await response.text().catch(() => '')
  throw new Error(`${what}: ${response.status} ${body.slice(0, 200)}`)
}

function answer(status: number, body: unknown): Response {
  return Response.json(body, { status })
}

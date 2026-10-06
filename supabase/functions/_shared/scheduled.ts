// The cron-driven Edge Functions and what each one's env loader requires (#41, D21(e)). It is plain
// data with no Deno API, so two runtimes read the one list:
// - each function boots through serveJob (./job.ts), which loads exactly these names, so the list
//   is the loader's own and cannot drift from it;
// - the deploy job's post-deploy check (scripts/check-function-secrets.ts, under Node) fails when the
//   live project's function secrets lack any of them.
//
// A function is listed here once pg_cron calls it: tests/db/scheduled-jobs.test.ts fails when a cron
// job runs a function this list does not name, or this list names one no cron job runs.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set by the platform for every function, hosted and
// local; CRON_SECRET is the one a person stores (README, Scheduled jobs). Every entry starts with the
// three serveJob itself needs, and a job's own names follow them.
export const SCHEDULED = {
  heartbeat: ['CRON_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'],
} as const satisfies Record<
  string,
  readonly ['CRON_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', ...string[]]
>

export type ScheduledJob = keyof typeof SCHEDULED

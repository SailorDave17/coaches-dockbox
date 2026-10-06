// The heartbeat (#35, #41): the trivial job the scheduled-job pattern is proven on before the roster
// sync, the purge, the digest and the health check depend on it. pg_cron runs it every 15 minutes
// (migration 20261005120000_scheduled_jobs.sql), and its work is nothing: the finished job_runs row
// it leaves is the heartbeat. tests/db/scheduled-jobs.test.ts follows a run from cron to that row.
//
// It still starts the way every function here must, with its env loaded at module scope (ADR 011),
// through serveJob. tests/db/heartbeat.test.ts calls it through the gateway.
import { serveJob } from '../_shared/job.ts'

serveJob('heartbeat', () => Promise.resolve(undefined))

// Scheduled jobs (#41, ADR 011, D21(e)): pg_cron runs private.run_job, which claims each due window of
// a job in public.job_runs and calls the job's Edge Function through pg_net with the cron secret from
// Vault. The function finishes the run. Every case is proven at the far end: a net._http_response row
// with the function's own 200, and a job_runs row the function finished. cron.job_run_details is never
// read, because it records only that the SQL ran.
//
// The heartbeat is the job under test. The cases pass fixed times in 2040 through run_job's p_now, so
// each knows its windows, and one fires the registered command through pg_cron itself. A far-off range
// does not isolate them on its own: run_job looks back from the current window with no floor, so a
// real-clock run would be the "last run" every case's catch-up counts from. So the real heartbeat job
// is paused for the file, and every heartbeat run is cleared before each case and after the last. On
// a local stack that clears the real heartbeat's own runs too, which are that stack's and disposable.
//
// Its prove-tests mutation is tests/mutations/job-runs-ignore-window.sql, which drops the (job,
// window_start) key the claim meets. Predicted: exactly one red, "calls the function once when it is
// invoked twice for one window".
//
// Like the other files here, it needs a local Supabase and its credentials in the environment
// (`npx supabase status -o env`), and fails rather than skipping without them. It also needs
// CRON_SECRET: the value exported before `npx supabase start`, which the edge runtime holds. The
// case stores it in Vault, as a person stores the live one.
import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { SCHEDULED } from '../../supabase/functions/_shared/scheduled.ts'

function env(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name]
    if (value) return value
  }
  throw new Error(
    `None of ${names.join(', ')} is set. Run \`npx supabase start\` with CRON_SECRET exported, then export \`npx supabase status -o env\`.`,
  )
}

const url = env('API_URL', 'SUPABASE_URL')
const anonKey = env('ANON_KEY', 'PUBLISHABLE_KEY')
const cronSecret = env('CRON_SECRET')
const sql = postgres(env('DB_URL'), { max: 1, onnotice: () => {} })

// Kong's name inside the local stack's network, which the database reaches it by (Supabase's own
// guide for a local stack, automatic embeddings, Step 2).
const PROJECT_URL = 'http://api.supabase.internal:8000'
const EVERY = '15 minutes'
const WINDOW_MS = 15 * 60_000

interface Run {
  id: string
  window_start: Date
  finished_at: Date | null
  ok: boolean | null
  detail: string | null
  request_id: string | null
}

const VAULT_NAMES = ['cron_secret', 'project_url'] as const
const vaultBefore = new Map<string, string | undefined>()

async function readSecret(name: string): Promise<string | undefined> {
  const [row] = await sql<{ value: string }[]>`
    select decrypted_secret as value from vault.decrypted_secrets where name = ${name}`
  return row?.value
}

/** Stores a Vault secret by name, replacing one already there. */
async function storeSecret(name: string, value: string): Promise<void> {
  const [row] = await sql<{ id: string }[]>`select id from vault.secrets where name = ${name}`
  if (row) await sql`select vault.update_secret(${row.id}::uuid, ${value})`
  else await sql`select vault.create_secret(${value}, ${name})`
}

async function dropSecret(name: string): Promise<void> {
  await sql`delete from vault.secrets where name = ${name}`
}

async function clearRuns(): Promise<void> {
  await sql`delete from public.job_runs where job = 'heartbeat'`
}

/** Pauses or resumes the migration's own heartbeat job. Measured on cron.job, so a pause that did not
 * land fails here rather than as a stray row in some later case. */
async function setHeartbeatActive(active: boolean): Promise<void> {
  const jobs = await sql<{ jobid: string }[]>`select jobid from cron.job where jobname = 'heartbeat'`
  if (jobs.length !== 1) throw new Error(`expected one cron job named heartbeat, found ${jobs.length}`)
  await sql`select cron.alter_job(${jobs[0]?.jobid ?? ''}::bigint, active := ${active})`
  const [job] = await sql<{ active: boolean }[]>`select active from cron.job where jobname = 'heartbeat'`
  if (job?.active !== active) throw new Error(`the heartbeat job did not become active = ${active}`)
}

beforeAll(async () => {
  await setHeartbeatActive(false)
  for (const name of VAULT_NAMES) vaultBefore.set(name, await readSecret(name))
  await storeSecret('cron_secret', cronSecret)
  await storeSecret('project_url', PROJECT_URL)
})

// Each case starts with no heartbeat runs: a run left by an earlier case would be the "last run" a
// later case's catch-up counts from.
beforeEach(clearRuns)

// Vault is left as it was found. The heartbeat job is resumed whatever state it was found in, because
// active is the migration's state: one found paused was paused by an interrupted run of this file.
afterAll(async () => {
  try {
    await clearRuns()
    for (const name of VAULT_NAMES) {
      const before = vaultBefore.get(name)
      if (before === undefined) await dropSecret(name)
      else await storeSecret(name, before)
    }
    await setHeartbeatActive(true)
  } finally {
    await sql.end()
  }
})

const at = (iso: string) => new Date(iso)
const plus = (date: Date, windows: number, minutes = 0) =>
  new Date(date.getTime() + windows * WINDOW_MS + minutes * 60_000)

/** Runs the heartbeat's SQL as pg_cron would, at a fixed time. Returns how many windows it called. */
async function runJob(now: Date, catchUp = 4): Promise<number> {
  const [row] = await sql<{ called: number }[]>`
    select private.run_job('heartbeat', ${EVERY}::interval, ${catchUp}::int, ${now}::timestamptz) as called`
  return row?.called ?? -1
}

async function runsIn(from: Date, to: Date): Promise<Run[]> {
  return sql<Run[]>`
    select id, window_start, finished_at, ok, detail, request_id
    from public.job_runs
    where job = 'heartbeat' and window_start >= ${from} and window_start <= ${to}
    order by window_start, id`
}

/** Polls until `check` returns a value, or fails naming what it waited for. */
async function waitFor<T>(what: string, check: () => Promise<T | undefined>, ms = 15_000): Promise<T> {
  const deadline = Date.now() + ms
  for (;;) {
    const value = await check()
    if (value !== undefined) return value
    if (Date.now() > deadline) throw new Error(`waited ${ms} ms for ${what}`)
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
}

/** The far end of one run: pg_net's stored response, and the run as the function finished it. */
async function farEnd(run: Run): Promise<{ status: number; body: unknown; run: Run }> {
  const response = await waitFor(`the response to run ${run.id}`, async () => {
    const [row] = await sql<{ status: number | null; content: string | null; error: string | null }[]>`
      select status_code as status, content, error_msg as error from net._http_response
      where id = ${run.request_id}`
    return row
  })
  const finished = await waitFor(`run ${run.id} to be finished`, async () => {
    const [row] = await sql<Run[]>`
      select id, window_start, finished_at, ok, detail, request_id from public.job_runs where id = ${run.id}`
    return row?.finished_at ? row : undefined
  })
  return {
    status: response.status ?? -1,
    body: response.content ? JSON.parse(response.content) : response.error,
    run: finished,
  }
}

describe('job_runs, the run record', () => {
  it('refuses anon and authenticated any query, and lets service_role only read and finish a run', async () => {
    // Through the Data API, as a browser holding the public key would ask.
    const viaApi = await fetch(`${url}/rest/v1/job_runs?select=id`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
    })
    expect({ status: viaApi.status, code: ((await viaApi.json()) as { code?: string }).code }).toEqual({
      status: 401,
      code: '42501',
    })

    // As each role, in a transaction that is rolled back.
    const refused: Record<string, string | undefined> = {}
    for (const role of ['anon', 'authenticated']) {
      refused[role] = await sql
        .begin(async (tx) => {
          await tx.unsafe(`set local role ${role}`)
          await tx`select id from public.job_runs limit 1`
          return 'read it'
        })
        .catch((error: { code?: string }) => error.code)
    }
    expect(refused).toEqual({ anon: '42501', authenticated: '42501' })

    // The positive control: the same read as service_role succeeds.
    const served = await sql.begin(async (tx) => {
      await tx`set local role service_role`
      return tx`select id from public.job_runs limit 1`
    })
    expect(Array.isArray(served)).toBe(true)

    const [grants] = await sql<{ granted: string[]; rls: boolean }[]>`
      select array(
        select format('%s %s', r.role, p.privilege)
        from unnest(array['anon', 'authenticated', 'service_role']) as r(role)
        cross join unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) as p(privilege)
        where has_table_privilege(r.role, 'public.job_runs', p.privilege)
        order by 1
      ) as granted,
      (select relrowsecurity from pg_class where oid = 'public.job_runs'::regclass) as rls`
    expect(grants?.rls).toBe(true)
    // Table-wide privileges only: has_table_privilege does not count a grant on some columns, so
    // service_role's UPDATE is read column by column next.
    expect(grants?.granted).toEqual(['service_role SELECT'])
    const [columns] = await sql<{ updatable: string[] }[]>`
      select array(
        select attname::text from pg_attribute
        where attrelid = 'public.job_runs'::regclass and attnum > 0 and not attisdropped
          and has_column_privilege('service_role', attrelid, attname, 'UPDATE')
        order by attname
      ) as updatable`
    expect(columns?.updatable).toEqual(['detail', 'finished_at', 'ok'])
  })
})

describe('private.run_job, the SQL half of every job', () => {
  it('calls the heartbeat for a fresh window, and the function itself answers 200 and finishes the run', async () => {
    const now = at('2040-01-02T00:07:00Z')
    expect(await runJob(now)).toBe(1)
    const [run] = await runsIn(at('2040-01-02T00:00:00Z'), now)
    if (!run) throw new Error('run_job claimed no window')
    expect(run.window_start).toEqual(at('2040-01-02T00:00:00Z'))

    const end = await farEnd(run)
    expect({ status: end.status, body: end.body }).toEqual({
      status: 200,
      body: { ok: true, run: Number(run.id) },
    })
    expect({ ok: end.run.ok, detail: end.run.detail }).toEqual({ ok: true, detail: null })
  })

  it('runs the command pg_cron holds for the heartbeat, fired by pg_cron itself', async () => {
    const [job] = await sql<{ schedule: string; command: string }[]>`
      select schedule, command from cron.job where jobname = 'heartbeat'`
    expect(job?.schedule).toBe('*/15 * * * *')
    if (!job) return
    expect(job.command).toBe("select private.run_job('heartbeat', interval '15 minutes')")

    // The same command on a one-second schedule, so pg_cron fires it now rather than at the next
    // quarter hour. It uses the real clock, so this case's window is the current one.
    const [start] = await sql<{ window: Date }[]>`
      select date_bin(${EVERY}::interval, now(), timestamptz '2000-01-01 00:00:00+00') as window`
    if (!start) throw new Error('no current window')
    const [probe] = await sql<{ jobid: string }[]>`
      select cron.schedule('heartbeat-cron-probe', '1 seconds', ${job.command}) as jobid`
    try {
      const run = await waitFor('pg_cron to claim the current window', async () => {
        const [row] = await runsIn(start.window, plus(start.window, 1))
        return row?.request_id ? row : undefined
      })
      const end = await farEnd(run)
      expect({ status: end.status, ok: end.run.ok }).toEqual({ status: 200, ok: true })
    } finally {
      await sql`select cron.unschedule('heartbeat-cron-probe')`
      // A probe run pg_cron had already started can still claim a window after the unschedule, so
      // the runs are cleared only once none is in flight.
      await waitFor('the probe to have no run in flight', async () => {
        const [busy] = await sql<{ count: number }[]>`
          select count(*)::int as count from cron.job_run_details
          where jobid = ${probe?.jobid ?? '0'}::bigint and status in ('starting', 'running')`
        return busy?.count === 0 ? true : undefined
      })
      await clearRuns()
    }
  })

  it.each(VAULT_NAMES)('raises without calling out when Vault holds no %s', async (name) => {
    const now = at('2040-01-03T00:07:00Z')
    const requests = async () => {
      const [row] = await sql<{ last: string | null }[]>`
        select pg_sequence_last_value('net.http_request_queue_id_seq'::regclass)::text as last`
      return row?.last ?? null
    }
    const before = await requests()
    await dropSecret(name)
    try {
      await expect(runJob(now)).rejects.toThrow(
        `run_job(heartbeat): Vault holds no ${name}, so nothing was called`,
      )
    } finally {
      await storeSecret(name, name === 'cron_secret' ? cronSecret : PROJECT_URL)
    }
    // A sequence is not rolled back, so a request queued and then undone would still show here.
    expect(await requests()).toBe(before)
    expect(await runsIn(at('2040-01-03T00:00:00Z'), now)).toEqual([])
  })

  it('calls the function once when it is invoked twice for one window', async () => {
    const now = at('2040-01-04T00:07:00Z')
    expect([await runJob(now), await runJob(now)]).toEqual([1, 0])
    const runs = await runsIn(at('2040-01-04T00:00:00Z'), now)
    expect(runs).toHaveLength(1)
    const [run] = runs
    if (run) expect((await farEnd(run)).status).toBe(200)
  })

  it('catches up the windows missed since the last run', async () => {
    const last = at('2040-01-05T00:00:00Z')
    await sql`
      insert into public.job_runs (job, window_start, finished_at, ok)
      values ('heartbeat', ${last}, ${last}, true)`
    const now = plus(last, 3, 7)
    expect(await runJob(now)).toBe(3)

    const missed = [plus(last, 1), plus(last, 2), plus(last, 3)]
    const runs = (await runsIn(plus(last, 1), now)).filter((run) => run.request_id !== null)
    expect(runs.map((run) => run.window_start)).toEqual(missed)
    const ends = await Promise.all(runs.map(farEnd))
    expect(ends.map((end) => [end.status, end.run.ok])).toEqual([
      [200, true],
      [200, true],
      [200, true],
    ])
  })

  it('catches up no further back than p_catch_up windows', async () => {
    const last = at('2040-01-06T00:00:00Z')
    await sql`
      insert into public.job_runs (job, window_start, finished_at, ok)
      values ('heartbeat', ${last}, ${last}, true)`
    const now = plus(last, 10, 7)
    expect(await runJob(now, 4)).toBe(4)
    const runs = await runsIn(plus(last, 1), now)
    expect(runs.map((run) => run.window_start)).toEqual([7, 8, 9, 10].map((n) => plus(last, n)))
  })

  // A run claimed under an earlier interval can sit between two of this interval's slots. Stepping on
  // from it unaligned would land on 00:25 and 00:40 and never claim the current window, 00:45.
  it('keeps to the window grid when the last run sits between two slots, claiming the current window', async () => {
    const offGrid = at('2040-01-08T00:10:00Z')
    await sql`
      insert into public.job_runs (job, window_start, finished_at, ok)
      values ('heartbeat', ${offGrid}, ${offGrid}, true)`
    const now = at('2040-01-08T00:52:00Z')
    expect(await runJob(now)).toBe(3)
    const runs = await runsIn(plus(offGrid, 0, 1), now)
    expect(runs.map((run) => run.window_start)).toEqual(
      ['00:15', '00:30', '00:45'].map((time) => at(`2040-01-08T${time}:00Z`)),
    )
  })
})

describe('the far end of a run', () => {
  async function deliver(body: unknown, secret = cronSecret): Promise<{ status: number; body: unknown }> {
    const response = await fetch(`${url}/functions/v1/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Cron-Secret': secret },
      body: JSON.stringify(body),
    })
    return { status: response.status, body: await response.json().catch(() => null) }
  }

  it('does nothing on a second delivery of a finished run, and refuses a run nobody claimed', async () => {
    const now = at('2040-01-07T00:07:00Z')
    expect(await runJob(now)).toBe(1)
    const [claimed] = await runsIn(at('2040-01-07T00:00:00Z'), now)
    if (!claimed) throw new Error('run_job claimed no window')
    const { run } = await farEnd(claimed)

    const call = { run: Number(run.id), job: 'heartbeat', window: run.window_start.toISOString() }
    expect(await deliver(call)).toEqual({ status: 200, body: { ok: true, run: call.run, duplicate: true } })
    const [after] = await runsIn(run.window_start, run.window_start)
    expect(after?.finished_at).toEqual(run.finished_at)

    expect(await deliver({ ...call, window: plus(run.window_start, 1).toISOString() })).toEqual({
      status: 404,
      body: { error: 'no claimed run has this id, job and window' },
    })
  })
})

describe('the scheduled functions and the cron jobs that call them', () => {
  it('match: every cron job running run_job names a function in scheduled.ts, and each one has a job', async () => {
    const jobs = await sql<{ command: string }[]>`select command from cron.job`
    const called = jobs
      .map((job) => /\bprivate\.run_job\('([a-z][a-z0-9-]*)'/.exec(job.command)?.[1])
      .filter((name) => name !== undefined)
      .sort()
    expect(called).toEqual(Object.keys(SCHEDULED).sort())
  })
})

// The scheduled-job handler (#41), under Deno: `npm run test:functions`. jobHandler is what serveJob
// serves, given the cron secret and a PostgREST caller. Here the caller is a fake holding one run row,
// which applies a PATCH's finished_at=is.null filter as PostgREST would and records every call, and
// the work is a stub that counts its calls. So each guard is held on its own, the two that stop a
// second delivery included: tests/db/scheduled-jobs.test.ts cannot tell them apart, because the
// heartbeat's work leaves no trace.
//
// Its prove-tests mutations are hand-run (no CI input reaches a Deno test): deleting the early return
// for a finished run reddens exactly "does not run the work for a run already finished"; dropping the
// PATCH's finished_at=is.null filter reddens exactly "finishes nothing when another delivery finished
// the run first".
import assert from 'node:assert/strict'
import { DETAIL_LIMIT, jobHandler, type Rest, type Work } from './job.ts'

const SECRET = 'c0ffee'.repeat(10) + 'c0ff'
const WINDOW = '2040-01-01T00:00:00.000Z'
const CALL = { run: 7, job: 'heartbeat', window: WINDOW }

interface Row {
  id: number
  job: string
  window_start: string
  finished_at: string | null
}

interface Options {
  row?: Partial<Row> | null
  // Another delivery finishes the run between this one's read and its write.
  lostRace?: boolean
  getStatus?: number
  patchStatus?: number
}

interface Recorded {
  method: string
  path: string
  body: Record<string, unknown> | undefined
}

function fakeRest(options: Options = {}): { rest: Rest; calls: Recorded[] } {
  const calls: Recorded[] = []
  const row: Row | null =
    options.row === null
      ? null
      : {
          id: 7,
          job: 'heartbeat',
          window_start: '2040-01-01T00:00:00+00:00',
          finished_at: null,
          ...options.row,
        }
  const rest: Rest = (path, init = {}) => {
    const method = init.method ?? 'GET'
    calls.push({ method, path, body: init.body ? JSON.parse(String(init.body)) : undefined })
    const status = method === 'GET' ? options.getStatus : options.patchStatus
    if (status !== undefined) return Promise.resolve(Response.json({ message: 'refused' }, { status }))
    if (method === 'GET') return Promise.resolve(Response.json(row ? [row] : []))
    const finishedAtWrite = row?.finished_at !== null || options.lostRace === true
    if (finishedAtWrite && path.includes('finished_at=is.null')) return Promise.resolve(Response.json([]))
    return Promise.resolve(Response.json([{ id: row?.id }]))
  }
  return { rest, calls }
}

function countingWork(result?: string | Error): { work: Work; windows: Date[] } {
  const windows: Date[] = []
  const work: Work = (window) => {
    windows.push(window)
    return result instanceof Error ? Promise.reject(result) : Promise.resolve(result)
  }
  return { work, windows }
}

function request(body: unknown, secret: string | null = SECRET, method = 'POST'): Request {
  const headers = new Headers({ 'Content-Type': 'application/json' })
  if (secret !== null) headers.set('X-Cron-Secret', secret)
  return new Request('http://localhost/functions/v1/heartbeat', {
    method,
    headers,
    ...(method === 'POST' ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}),
  })
}

async function run(
  options: Options,
  work: Work,
  req: Request = request(CALL),
): Promise<{ status: number; body: unknown; calls: Recorded[] }> {
  const { rest, calls } = fakeRest(options)
  const response = await jobHandler('heartbeat', work, { cronSecret: SECRET, rest })(req)
  return { status: response.status, body: await response.json(), calls }
}

const methods = (calls: Recorded[]) => calls.map((call) => call.method)

Deno.test('runs the work once for a claimed, unfinished run, and records it finished', async () => {
  const { work, windows } = countingWork()
  const result = await run({}, work)
  assert.deepEqual({ status: result.status, body: result.body }, { status: 200, body: { ok: true, run: 7 } })
  assert.deepEqual(windows, [new Date(WINDOW)])
  assert.deepEqual(methods(result.calls), ['GET', 'PATCH'])
  const patch = result.calls[1]
  assert.ok(patch?.path.includes('id=eq.7') && patch.path.includes('finished_at=is.null'))
  assert.equal(patch?.body?.ok, true)
  assert.equal(patch?.body?.detail, null)
  assert.equal(typeof patch?.body?.finished_at, 'string')
})

Deno.test('does not run the work for a run already finished', async () => {
  const { work, windows } = countingWork()
  const result = await run({ row: { finished_at: '2040-01-01T00:00:05+00:00' } }, work)
  assert.deepEqual(
    { status: result.status, body: result.body },
    { status: 200, body: { ok: true, run: 7, duplicate: true } },
  )
  assert.equal(windows.length, 0)
  assert.deepEqual(methods(result.calls), ['GET'])
})

Deno.test('finishes nothing when another delivery finished the run first', async () => {
  const { work } = countingWork()
  const result = await run({ lostRace: true }, work)
  assert.deepEqual(
    { status: result.status, body: result.body },
    { status: 200, body: { ok: true, run: 7, duplicate: true } },
  )
  assert.deepEqual(methods(result.calls), ['GET', 'PATCH'])
})

Deno.test("records a run whose work threw as failed, keeping only the error's name", async () => {
  const { work } = countingWork(new TypeError('a message that must not be stored'))
  const result = await run({}, work)
  assert.deepEqual({ status: result.status, body: result.body }, { status: 500, body: { ok: false, run: 7 } })
  const patch = result.calls[1]
  assert.equal(patch?.body?.ok, false)
  assert.equal(patch?.body?.detail, 'the work threw TypeError')
})

Deno.test("stores the work's detail, cut to the column's limit", async () => {
  const short = await run({}, countingWork('3 rows').work)
  assert.equal(short.calls[1]?.body?.detail, '3 rows')
  const long = await run({}, countingWork('x'.repeat(DETAIL_LIMIT + 50)).work)
  assert.equal(long.calls[1]?.body?.detail, 'x'.repeat(DETAIL_LIMIT))
})

Deno.test(
  'refuses a call without the cron secret, with a wrong one of the same length, or with more after it, reading nothing',
  async () => {
    const flipped = SECRET.slice(0, -1) + (SECRET.endsWith('f') ? 'e' : 'f')
    for (const secret of [null, '', flipped, `${SECRET}0`]) {
      const { work, windows } = countingWork()
      const result = await run({}, work, request(CALL, secret))
      assert.deepEqual(
        { status: result.status, body: result.body },
        { status: 401, body: { error: 'cron secret required' } },
        `secret: ${secret === null ? 'absent' : `${secret.length} characters`}`,
      )
      assert.deepEqual(result.calls, [])
      assert.equal(windows.length, 0)
    }
  },
)

Deno.test('refuses anything but a POST, reading nothing', async () => {
  const result = await run({}, countingWork().work, request(CALL, SECRET, 'GET'))
  assert.deepEqual(
    { status: result.status, body: result.body },
    { status: 405, body: { error: 'POST only' } },
  )
  assert.deepEqual(result.calls, [])
})

Deno.test('refuses a body that is not a run of this job, reading nothing', async () => {
  const bodies: unknown[] = [
    'not json',
    null,
    {},
    { ...CALL, run: 0 },
    { ...CALL, run: 1.5 },
    { ...CALL, run: '7' },
    { ...CALL, job: 'purge' },
    { ...CALL, window: 'not a time' },
    { ...CALL, window: 5 },
  ]
  for (const body of bodies) {
    const result = await run({}, countingWork().work, request(body))
    assert.equal(result.status, 400, JSON.stringify(body))
    assert.deepEqual(result.calls, [])
  }
})

Deno.test(
  'answers 404 for a run nobody claimed, or one claimed for another job or window, running nothing',
  async () => {
    const rows: (Partial<Row> | null)[] = [
      null,
      { job: 'purge' },
      { window_start: '2040-01-01T00:15:00+00:00' },
    ]
    for (const row of rows) {
      const { work, windows } = countingWork()
      const result = await run({ row }, work)
      assert.deepEqual(
        { status: result.status, body: result.body },
        { status: 404, body: { error: 'no claimed run has this id, job and window' } },
        JSON.stringify(row),
      )
      assert.equal(windows.length, 0)
      assert.deepEqual(methods(result.calls), ['GET'])
    }
  },
)

Deno.test('answers 502 when the run cannot be read, running nothing, or cannot be recorded', async () => {
  const unread = countingWork()
  const read = await run({ getStatus: 503 }, unread.work)
  assert.deepEqual(
    { status: read.status, body: read.body },
    { status: 502, body: { error: 'the run record could not be read or written' } },
  )
  assert.equal(unread.windows.length, 0)

  const written = await run({ patchStatus: 500 }, countingWork().work)
  assert.equal(written.status, 502)
  assert.deepEqual(methods(written.calls), ['GET', 'PATCH'])
})

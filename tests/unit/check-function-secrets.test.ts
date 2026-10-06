// The post-deploy secrets check (#41, D21(e)), scripts/check-function-secrets.ts. It is run here as npm
// would run it, against a local server standing in for the Management API, which answers the secrets
// list with whatever a case sets and records every request. So a refusal that must come first is
// measured as zero requests, and a pass is measured against a list that holds exactly the names given.
//
// What the cron-driven functions require is read from supabase/functions/_shared/scheduled.ts, the
// list the check itself reads, so a new function's names are covered here without editing this file.
import { execFile } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { SCHEDULED } from '../../supabase/functions/_shared/scheduled.ts'

const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> }
const script = /^node (\S+)$/.exec(packageJson.scripts['check:secrets'] ?? '')?.[1]

const TOKEN = 'planted-access-token'
const REF = 'plantedref'
// Every name a scheduled function's loader requires, and the platform's others beside them.
const REQUIRED = [...new Set(Object.values(SCHEDULED).flat())].sort()
const PLATFORM_OTHERS = ['SUPABASE_ANON_KEY', 'SUPABASE_DB_URL']

let server: Server
let serverUrl = ''
let status = 200
let answer: unknown = []
let requests: { path: string; authorization: string | undefined }[] = []

beforeAll(async () => {
  server = createServer((request, response) => {
    requests.push({ path: request.url ?? '', authorization: request.headers.authorization })
    request.resume()
    response.writeHead(status, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify(answer))
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  serverUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()))
})
beforeEach(() => {
  status = 200
  answer = []
  requests = []
})

/** The list as the Management API gives it: a name, a digest of the value, and when it was set. */
const secrets = (...names: string[]) =>
  names.map((name) => ({ name, value: `digest-of-${name}`, updated_at: '2026-10-05T00:00:00Z' }))

interface Run {
  code: number | null
  stdout: string
  stderr: string
}

/** Runs the check with exactly these variables, whatever the shell running the tests holds. */
function check(env: Record<string, string>): Promise<Run> {
  if (!script) throw new Error('package.json has no `check:secrets` script of the form `node <file>`')
  const childEnv: NodeJS.ProcessEnv = { ...process.env }
  for (const name of ['SUPABASE_ACCESS_TOKEN', 'SUPABASE_PROJECT_REF', 'SUPABASE_MANAGEMENT_API_URL']) {
    delete childEnv[name]
  }
  return new Promise((resolve) => {
    execFile(process.execPath, [script], { env: { ...childEnv, ...env } }, (error, stdout, stderr) => {
      const code = error ? (typeof error.code === 'number' ? error.code : null) : 0
      resolve({ code, stdout, stderr })
    })
  })
}

const live = () => ({
  SUPABASE_ACCESS_TOKEN: TOKEN,
  SUPABASE_PROJECT_REF: REF,
  SUPABASE_MANAGEMENT_API_URL: serverUrl,
})

describe('the post-deploy secrets check', () => {
  it('requires at least the cron secret of every scheduled function, so the cases below test something', () => {
    expect(Object.keys(SCHEDULED).length).toBeGreaterThan(0)
    expect(REQUIRED).toContain('CRON_SECRET')
  })

  it("passes when the live list holds every name, listing the project's secrets by name", async () => {
    answer = secrets(...PLATFORM_OTHERS, ...REQUIRED)
    const run = await check(live())
    expect({ code: run.code, stderr: run.stderr }).toEqual({ code: 0, stderr: '' })
    expect(run.stdout).toContain(
      `Live function secrets: ${[...PLATFORM_OTHERS, ...REQUIRED].sort().join(', ')}`,
    )
    for (const job of Object.keys(SCHEDULED)) expect(run.stdout).toContain(`${job}: `)
    expect(requests).toEqual([{ path: `/v1/projects/${REF}/secrets`, authorization: `Bearer ${TOKEN}` }])
  })

  it('never prints a value the list carries', async () => {
    answer = secrets(...REQUIRED)
    const run = await check(live())
    expect(`${run.stdout}${run.stderr}`).not.toContain('digest-of-')
  })

  it.each(REQUIRED)('fails naming %s when the live list lacks it', async (name) => {
    answer = secrets(...PLATFORM_OTHERS, ...REQUIRED.filter((other) => other !== name))
    const run = await check(live())
    expect(run.code).toBe(1)
    const named = Object.entries(SCHEDULED)
      .filter(([, names]) => (names as readonly string[]).includes(name))
      .map(([job]) => `${job} requires ${name}, which the live project does not hold`)
    for (const line of named) expect(run.stderr).toContain(line)
  })

  it('fails on a refused list, naming the status', async () => {
    status = 401
    answer = { message: 'Unauthorized' }
    const run = await check(live())
    expect({ code: run.code, stderr: run.stderr.trim() }).toEqual({
      code: 1,
      stderr: 'The Management API answered the secrets list with 401, not 200.',
    })
  })

  it('fails on an answer that is not a list of names', async () => {
    answer = { secrets: REQUIRED }
    const run = await check(live())
    expect(run.code).toBe(1)
    expect(run.stderr).toContain('something other than a list of names')
  })

  it.each([
    ['SUPABASE_ACCESS_TOKEN', { SUPABASE_PROJECT_REF: REF }],
    ['SUPABASE_PROJECT_REF', { SUPABASE_ACCESS_TOKEN: TOKEN }],
    ['SUPABASE_ACCESS_TOKEN', { SUPABASE_ACCESS_TOKEN: '  ', SUPABASE_PROJECT_REF: REF }],
  ])('stops before any request when %s is unset or blank', async (name, env) => {
    const run = await check({ ...env, SUPABASE_MANAGEMENT_API_URL: serverUrl })
    expect(run.code).toBe(1)
    expect(run.stderr).toContain(`Not set: ${name}.`)
    expect(requests).toEqual([])
  })
})

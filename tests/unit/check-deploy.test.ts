// The post-deploy check's project half and its refusals at start (#38). A paused Supabase project
// answers every request with 540, and the check must say "paused", in the step the deploy job runs
// before anything reaches production and in the one it runs after. VITE_SUPABASE_URL points at a local
// server that answers /auth/v1/health with whatever status a case sets and records every request, so
// a refusal that must come first is measured as zero requests.
//
// Loading a deployed page needs Chromium, so that half is tests/screens/check-deploy.spec.ts. Every case
// here stops before the check launches a browser.
import { execFile } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

// The npm script is `node <file>`, read from package.json, so this runs what npm would run.
const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> }
const script = /^node (\S+)$/.exec(packageJson.scripts['check:deploy'] ?? '')?.[1]

const KEY = 'planted-public-key'
let server: Server
let serverUrl = ''
let status = 200
let requests: { path: string; apikey: string | undefined }[] = []
let scratch = ''

beforeAll(async () => {
  server = createServer((request, response) => {
    requests.push({ path: request.url ?? '', apikey: request.headers.apikey as string | undefined })
    request.resume()
    response.writeHead(status, { 'Content-Type': 'application/json' })
    response.end('{}')
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  serverUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  scratch = mkdtempSync(join(tmpdir(), 'check-deploy-'))
})
afterAll(async () => {
  rmSync(scratch, { recursive: true, force: true })
  await new Promise<void>((resolve) => server.close(() => resolve()))
})
beforeEach(() => {
  status = 200
  requests = []
})

interface Run {
  code: number | null
  stdout: string
  stderr: string
}

/** Runs the check with exactly these two variables, whatever the shell running the tests holds. */
function check(
  args: string[],
  env: { VITE_SUPABASE_URL?: string; VITE_SUPABASE_ANON_KEY?: string },
): Promise<Run> {
  if (!script) throw new Error('package.json has no `check:deploy` script of the form `node <file>`')
  const childEnv: NodeJS.ProcessEnv = { ...process.env }
  delete childEnv.VITE_SUPABASE_URL
  delete childEnv.VITE_SUPABASE_ANON_KEY
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [script, ...args],
      { env: { ...childEnv, ...env } },
      (error, stdout, stderr) => {
        const code = error ? (typeof error.code === 'number' ? error.code : null) : 0
        resolve({ code, stdout, stderr })
      },
    )
  })
}

const live = () => ({ VITE_SUPABASE_URL: serverUrl, VITE_SUPABASE_ANON_KEY: KEY })

describe('the project check', () => {
  it('passes on a project that answers its health check, sent with the public key', async () => {
    const run = await check(['--project'], live())
    expect(run.stderr).toBe('')
    expect(run.code).toBe(0)
    expect(run.stdout).toBe(`The Supabase project at ${serverUrl} is up.\n`)
    expect(requests).toEqual([{ path: '/auth/v1/health', apikey: KEY }])
  })

  it('fails naming the pause when the project answers 540', async () => {
    status = 540
    const run = await check(['--project'], live())
    expect(run.code).toBe(1)
    expect(run.stderr).toMatch(new RegExp(`^The Supabase project at ${serverUrl} is paused: .*Restore it`))
    expect(run.stdout).toBe('')
  })

  it('fails naming the status, not a pause, on any other refusal', async () => {
    status = 401
    const run = await check(['--project'], live())
    expect(run.code).toBe(1)
    expect(run.stderr).toBe(
      `The Supabase project at ${serverUrl} answered /auth/v1/health with 401, not 200.\n`,
    )
  })

  it('fails naming the project when nothing answers', async () => {
    const closed = createServer()
    await new Promise<void>((resolve) => closed.listen(0, '127.0.0.1', resolve))
    const gone = `http://127.0.0.1:${(closed.address() as AddressInfo).port}`
    await new Promise<void>((resolve) => closed.close(() => resolve()))
    const run = await check(['--project'], { VITE_SUPABASE_URL: gone, VITE_SUPABASE_ANON_KEY: KEY })
    expect(run.code).toBe(1)
    expect(run.stderr).toMatch(
      new RegExp(`^The Supabase project at ${gone} did not answer /auth/v1/health: `),
    )
  })

  it('stops before any request, naming each public value that is unset or blank', async () => {
    const run = await check(['--project'], { VITE_SUPABASE_URL: serverUrl, VITE_SUPABASE_ANON_KEY: ' ' })
    expect(run.code).toBe(1)
    expect(run.stderr).toMatch(/^Not set: VITE_SUPABASE_ANON_KEY\. /)
    const neither = await check(['--project'], {})
    expect(neither.stderr).toMatch(/^Not set: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY\. /)
    expect(requests).toEqual([])
  })
})

describe('the page check, before it loads a page', () => {
  it('fails naming the pause and loads no page when the project is paused', async () => {
    status = 540
    const run = await check(
      ['--sha', 'abcdef1234567', '--url', `${serverUrl}/page`, '--attempts', '1'],
      live(),
    )
    expect(run.code).toBe(1)
    expect(run.stderr).toMatch(/ is paused: /)
    expect(requests.map((request) => request.path)).toEqual(['/auth/v1/health'])
  })

  it.each([
    ['no --sha', ['--url', 'http://127.0.0.1:1/']],
    ['a --sha that is not one', ['--sha', 'release', '--url', 'http://127.0.0.1:1/']],
    ['no URL at all', ['--sha', 'abcdef1']],
    [
      'both --url and --wrangler-output',
      ['--sha', 'abcdef1', '--url', 'http://127.0.0.1:1/', '--wrangler-output', 'x'],
    ],
    ['--project with a page option', ['--project', '--sha', 'abcdef1']],
    ['--attempts 0', ['--sha', 'abcdef1', '--url', 'http://127.0.0.1:1/', '--attempts', '0']],
    ['an option it does not know', ['--sha', 'abcdef1', '--url', 'http://127.0.0.1:1/', '--retry']],
  ])('refuses %s before any request', async (_name, args) => {
    const run = await check(args, live())
    expect(run.code).toBe(1)
    expect(run.stderr).toContain('usage: npm run check:deploy')
    expect(requests).toEqual([])
  })

  it("refuses wrangler's output when its deploy entry names no URL, before any request", async () => {
    // What wrangler 4.147 writes for a Worker with a custom domain and workers.dev off: a session entry,
    // then a deploy entry whose one target is a bare name.
    const file = join(scratch, 'no-url.json')
    writeFileSync(
      file,
      [
        JSON.stringify({ type: 'wrangler-session', version: 1, wrangler_version: '4.147.0' }),
        JSON.stringify({
          type: 'deploy',
          version: 1,
          worker_name: 'coaches-dockbox',
          targets: ['example.test (custom domain)'],
        }),
      ].join('\n'),
    )
    const run = await check(['--sha', 'abcdef1', '--wrangler-output', file], live())
    expect(run.code).toBe(1)
    expect(run.stderr).toBe(`Wrangler's output, ${file}, names no deployed URL.\n`)
    expect(requests).toEqual([])
  })

  it("refuses wrangler's output when the file is missing, naming it", async () => {
    const file = join(scratch, 'never-written.json')
    const run = await check(['--sha', 'abcdef1', '--wrangler-output', file], live())
    expect(run.code).toBe(1)
    expect(run.stderr).toMatch(
      new RegExp(`^Could not read wrangler's output, ${file.replaceAll('\\', '\\\\')}: `),
    )
    expect(requests).toEqual([])
  })
})

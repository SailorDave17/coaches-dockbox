// The post-deploy check's page half (#38, scripts/check-deploy.ts), run as the deploy job runs it, on
// the built app the preview server serves. It passes only on a started app stamped with the commit it
// was given. The app that did not start is the real one too: this repository's app built without its
// two public values, so src/config.ts throws at load, served by a small static server below.
//
// VITE_SUPABASE_URL points at a local server whose health check answers 200: the paused project is
// tests/unit/check-deploy.test.ts, which needs no browser.
import { execFile, execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { extname, join, normalize } from 'node:path'
import { expect, test } from '@playwright/test'

const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const short = commit.slice(0, 7)

interface Run {
  code: number | null
  stdout: string
  stderr: string
}

function listen(server: Server): Promise<string> {
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () =>
      resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}`),
    ),
  )
}

const close = (server: Server) => new Promise<void>((resolve) => server.close(() => resolve()))

let scratch = ''
let health: Server
let healthUrl = ''
let unstarted: Server
let unstartedUrl = ''

const TYPES: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }

test.beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'check-deploy-'))
  health = createServer((request, response) => {
    request.resume()
    response.writeHead(request.url === '/auth/v1/health' ? 200 : 404).end()
  })
  healthUrl = await listen(health)

  // The app built with both public values blank. A value in the environment outranks .env.local, so a
  // blank one is what config.ts sees here, as in a deploy whose Actions variables were never set.
  const outDir = join(scratch, 'unstarted')
  execFileSync(
    process.execPath,
    ['node_modules/vite/bin/vite.js', 'build', '--outDir', outDir, '--logLevel', 'error'],
    {
      env: { ...process.env, VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' },
    },
  )
  unstarted = createServer((request, response) => {
    const path = new URL(request.url ?? '/', 'http://x').pathname
    if (path === '/missing') return response.writeHead(404, { 'Content-Type': 'text/plain' }).end('not here')
    const file = join(outDir, normalize(path === '/' ? '/index.html' : path))
    try {
      const body = readFileSync(file)
      response
        .writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' })
        .end(body)
    } catch {
      response.writeHead(404).end()
    }
  })
  unstartedUrl = await listen(unstarted)
})

test.afterAll(async () => {
  await Promise.all([close(health), close(unstarted)])
  rmSync(scratch, { recursive: true, force: true })
})

function check(args: string[]): Promise<Run> {
  const env = { ...process.env, VITE_SUPABASE_URL: healthUrl, VITE_SUPABASE_ANON_KEY: 'planted-public-key' }
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      ['scripts/check-deploy.ts', '--attempts', '1', ...args],
      { env },
      (error, stdout, stderr) => {
        const code = error ? (typeof error.code === 'number' ? error.code : null) : 0
        resolve({ code, stdout, stderr })
      },
    )
  })
}

const appUrl = () => test.info().project.use.baseURL ?? ''

test('passes on the built app, started and stamped with the commit it was given', async () => {
  const run = await check(['--sha', commit, '--url', appUrl()])
  expect(run.stderr).toBe('')
  expect(run.code).toBe(0)
  expect(run.stdout).toContain(`${appUrl()} started, stamped ${short}.`)
})

test('fails naming both commits when the page carries another one', async () => {
  const other = short === '0000000' ? '1111111' : '0000000'
  const run = await check(['--sha', other, '--url', appUrl()])
  expect(run.code).toBe(1)
  expect(run.stderr).toBe(`${appUrl()} is stamped ${short}, not ${other}, the commit this check was given.\n`)
})

test('fails naming what config.ts threw when the app did not start', async () => {
  const run = await check(['--sha', commit, '--url', unstartedUrl])
  expect(run.code).toBe(1)
  expect(run.stderr).toMatch(
    new RegExp(
      `^${unstartedUrl} did not start: it answered 200, and no build stamp appeared\\. The page threw: VITE_SUPABASE_URL is not set\\.`,
    ),
  )
})

test('fails naming the status when the address serves no app', async () => {
  const run = await check(['--sha', commit, '--url', `${unstartedUrl}/missing`])
  expect(run.code).toBe(1)
  expect(run.stderr).toBe(`${unstartedUrl}/missing did not start: it answered 404, not the app.\n`)
})

test("checks every URL in wrangler's deploy entry, and skips a target that is a bare name", async () => {
  // The shape wrangler 4.147 writes to WRANGLER_OUTPUT_FILE_PATH: a session entry, then the deploy.
  // Wrangler writes the workers.dev address as a URL and a custom domain as a bare name.
  const file = join(scratch, 'wrangler-output.json')
  writeFileSync(
    file,
    [
      JSON.stringify({ type: 'wrangler-session', version: 1, wrangler_version: '4.147.0' }),
      JSON.stringify({
        type: 'deploy',
        version: 1,
        worker_name: 'coaches-dockbox',
        targets: [appUrl(), 'example.test (custom domain)'],
      }),
    ].join('\n'),
  )
  const run = await check(['--sha', commit, '--wrangler-output', file])
  expect(run.stderr).toBe('')
  expect(run.code).toBe(0)
  expect(run.stdout.trim().split('\n')).toEqual([
    `The Supabase project at ${healthUrl} is up.`,
    `${appUrl()} started, stamped ${short}.`,
  ])
})

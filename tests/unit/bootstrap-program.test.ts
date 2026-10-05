// The bootstrap command's refusals at start (#63). With no service key, a blank one, or arguments
// it cannot use, the command must stop before its first request, name what is wrong, and print no
// ids. It runs as `npm run bootstrap:program` would run it, and SUPABASE_URL points at a local server
// that counts every request it is sent. A zero count means the refusal came first, and the control
// case below proves the server counts a request the command does send.
//
// What the command writes, and that the same arguments twice duplicate nothing, is
// tests/db/bootstrap-program.test.ts, which needs a local Supabase.
import { execFile } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

// The npm script is `node <file>`, read from package.json, so this runs what npm would run.
const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> }
const script = /^node (\S+)$/.exec(packageJson.scripts['bootstrap:program'] ?? '')?.[1]

let server: Server
let serverUrl = ''
let requests = 0

beforeAll(async () => {
  // Not retried by postgrest-js (it retries 503 and 520 only), so the control case ends at once.
  server = createServer((request, response) => {
    requests += 1
    request.resume()
    response.writeHead(401, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({ message: 'the counting server refuses everything' }))
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  serverUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())))
beforeEach(() => {
  requests = 0
})

interface Run {
  code: number | null
  stdout: string
  stderr: string
}

/** Runs the command with exactly these two variables, whatever the shell running the tests holds. */
function bootstrap(
  args: string[],
  env: { SUPABASE_URL?: string; SUPABASE_SERVICE_ROLE_KEY?: string },
): Promise<Run> {
  if (!script) throw new Error('package.json has no `bootstrap:program` script of the form `node <file>`')
  const childEnv: NodeJS.ProcessEnv = { ...process.env }
  delete childEnv.SUPABASE_URL
  delete childEnv.SUPABASE_SERVICE_ROLE_KEY
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

// Invented, like every person in this repo.
const VALID = [
  '--program',
  'Invented Sailing Program',
  '--season',
  'Spring 2099',
  '--starts',
  '2099-04-01',
  '--ends',
  '2099-08-31',
  '--first',
  'Dana',
  '--last',
  'Example',
  '--email',
  'dana@example.test',
]

/** VALID with one flag's value replaced, or the flag and its value removed when value is null. */
function withFlag(flag: string, value: string | null): string[] {
  const at = VALID.indexOf(flag)
  const args = [...VALID]
  if (value === null) args.splice(at, 2)
  else args[at + 1] = value
  return args
}

describe('the bootstrap command reaches the server it is given (control)', () => {
  it('sends a request when the key and the arguments are good', async () => {
    const run = await bootstrap(VALID, {
      SUPABASE_URL: serverUrl,
      SUPABASE_SERVICE_ROLE_KEY: 'not-a-real-key',
    })
    expect({ code: run.code, stdout: run.stdout, reached: requests > 0 }).toEqual({
      code: 1,
      stdout: '',
      reached: true,
    })
  })
})

describe('the bootstrap command refuses a missing key at start (#63)', () => {
  // `withUrl` points SUPABASE_URL at the counting server, so a request made anyway is counted.
  it.each<[string, { withUrl: boolean; key?: string }, string]>([
    ['no service key', { withUrl: true }, 'SUPABASE_SERVICE_ROLE_KEY'],
    ['a blank service key', { withUrl: true, key: '  ' }, 'SUPABASE_SERVICE_ROLE_KEY'],
    ['neither variable', { withUrl: false }, 'SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY'],
  ])('with %s, names the missing variable and sends nothing', async (_, given, named) => {
    const env = {
      ...(given.withUrl ? { SUPABASE_URL: serverUrl } : {}),
      ...(given.key === undefined ? {} : { SUPABASE_SERVICE_ROLE_KEY: given.key }),
    }
    const run = await bootstrap(VALID, env)
    expect({ code: run.code, stdout: run.stdout, requests }).toEqual({ code: 1, stdout: '', requests: 0 })
    expect(run.stderr).toContain(`Missing required environment variable(s): ${named}.`)
  })
})

describe('the bootstrap command refuses arguments it cannot use, before any request (#63)', () => {
  it.each([
    ['no --season', withFlag('--season', null), 'Missing --season.'],
    ['a blank --first', withFlag('--first', ' '), 'Missing --first.'],
    ['a date that is not on the calendar', withFlag('--starts', '2099-02-30'), '--starts must be a date'],
    ['a date in another format', withFlag('--ends', '31/08/2099'), '--ends must be a date'],
    ['a season that ends before it starts', withFlag('--ends', '2099-03-31'), '--ends must be on or after'],
    ['an email that is not an address', withFlag('--email', 'dana.example.test'), '--email must be an email'],
    ['an unknown flag', [...VALID, '--role', 'coach'], "Unknown option '--role'"],
    ['a stray positional argument', [...VALID, 'extra'], 'Unexpected argument'],
  ])('refuses %s', async (_, args, named) => {
    const run = await bootstrap(args, {
      SUPABASE_URL: serverUrl,
      SUPABASE_SERVICE_ROLE_KEY: 'not-a-real-key',
    })
    expect({ code: run.code, stdout: run.stdout, requests }).toEqual({ code: 1, stdout: '', requests: 0 })
    expect(run.stderr).toContain(named)
  })
})

// The post-deploy check (#38, D21(b)): did the deploy put a started app, of this commit, in front of
// the live project, and is that project up? The deploy job runs it twice: before anything reaches
// production, to refuse a paused project, and after the Worker is deployed, on the page it serves.
//
//   npm run check:deploy -- --project
//   npm run check:deploy -- --sha <commit> (--url <url> ... | --wrangler-output <file>) [--attempts <n>]
//
// It reads VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from the environment, the two public values
// the build compiles in, and stops before any request when either is unset or blank.
//
// The project: a GET of /auth/v1/health with the public key. A paused project answers every request
// with 540, Supabase's code for exactly that (supabase.com/docs/guides/troubleshooting/http-status-codes,
// read 2026-10-05), and the check names the pause rather than the code. Free projects pause after a
// week without use (ADR 001), and every later step would otherwise fail without saying why.
//
// The page: each URL is loaded in headless Chromium, in a fresh context with service workers blocked,
// so the page comes from the server and never from a worker an earlier build installed (cairn memory,
// a-service-worker-outlives-the-promotion). It passes when the footer's build stamp appears and names
// the commit given with --sha. The footer renders only after src/config.ts has loaded, so a stamp is
// also the proof the app started: when the loader throws, the page stays blank and the check prints
// what the page threw. A page that fails is loaded again, up to --attempts times (3 unless given),
// 10 s apart, because a new deploy can take a few seconds to reach every edge.
//
// --wrangler-output reads the file `wrangler deploy` writes to WRANGLER_OUTPUT_FILE_PATH, and checks
// every target in its deploy entry that is a URL. Wrangler writes the workers.dev address as a URL and
// a custom domain or route as a bare name, so today that is the workers.dev address (wrangler 4.147).
//
// A failure sets process.exitCode and returns, like the bootstrap command (scripts/bootstrap-program.ts).
import { readFileSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'
import { parseArgs } from 'node:util'
import { chromium, type Browser } from '@playwright/test'

const USAGE = `usage: npm run check:deploy -- --project
       npm run check:deploy -- --sha <commit> (--url <url> ... | --wrangler-output <file>) [--attempts <n>]`

const ENV_NAMES = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'] as const

const PAUSED = 540
const HEALTH_PATH = '/auth/v1/health'

// The footer's text, as src/App.tsx renders it.
const STAMP = /Build ([0-9a-f]{7})\b/
const START_TIMEOUT_MS = 15_000
// How long the stamp may still appear after the page throws, before the check stops waiting.
const AFTER_ERROR_MS = 2_000
const RETRY_WAIT_MS = 10_000

function fail(message: string): void {
  console.error(message)
  process.exitCode = 1
}

async function projectProblem(supabaseUrl: string, key: string): Promise<string | undefined> {
  const health = `${supabaseUrl.replace(/\/+$/, '')}${HEALTH_PATH}`
  let status: number
  try {
    const response = await fetch(health, { headers: { apikey: key }, signal: AbortSignal.timeout(15_000) })
    status = response.status
    await response.arrayBuffer()
  } catch (error) {
    const cause = error instanceof Error && error.cause !== undefined ? ` (${String(error.cause)})` : ''
    return `The Supabase project at ${supabaseUrl} did not answer ${HEALTH_PATH}: ${String(error)}${cause}`
  }
  if (status === PAUSED) {
    return (
      `The Supabase project at ${supabaseUrl} is paused: it answered ${HEALTH_PATH} with 540, ` +
      "Supabase's code for a paused project. Restore it from the Supabase dashboard, then re-run this job."
    )
  }
  if (status !== 200)
    return `The Supabase project at ${supabaseUrl} answered ${HEALTH_PATH} with ${status}, not 200.`
  return undefined
}

function deployedUrls(file: string): string[] {
  const entries = readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line) as { type?: unknown; targets?: unknown })
  const deploy = entries.filter((entry) => entry.type === 'deploy').at(-1)
  const targets: unknown[] = Array.isArray(deploy?.targets) ? deploy.targets : []
  return targets.filter(
    (target): target is string => typeof target === 'string' && /^https?:\/\/\S+$/.test(target),
  )
}

async function pageProblem(browser: Browser, url: string, commit: string): Promise<string | undefined> {
  const context = await browser.newContext({ serviceWorkers: 'block' })
  try {
    const page = await context.newPage()
    const errors: string[] = []
    let firstErrorAt: number | undefined
    page.on('pageerror', (error) => {
      errors.push(error.message)
      firstErrorAt ??= Date.now()
    })
    let status: number | undefined
    try {
      status = (await page.goto(url, { waitUntil: 'load', timeout: 30_000 }))?.status()
    } catch (error) {
      return `${url} did not load: ${(error instanceof Error ? error.message : String(error)).split('\n')[0]}`
    }
    // The Worker answers every path with the app (single-page-application), so an error status is
    // not the app and no stamp is coming.
    if (status !== undefined && status >= 400)
      return `${url} did not start: it answered ${status}, not the app.`
    const footer = page.getByRole('contentinfo').filter({ hasText: STAMP })
    const deadline = Date.now() + START_TIMEOUT_MS
    let text: string | undefined
    while (Date.now() < deadline) {
      text = (await footer.allTextContents())[0]
      if (text !== undefined) break
      if (firstErrorAt !== undefined && Date.now() - firstErrorAt > AFTER_ERROR_MS) break
      await sleep(250)
    }
    if (text === undefined) {
      const threw = errors.length > 0 ? ` The page threw: ${errors.join(' | ')}` : ''
      return `${url} did not start: it answered ${status ?? 'nothing'}, and no build stamp appeared.${threw}`
    }
    const shown = STAMP.exec(text)?.[1]
    if (shown !== commit) return `${url} is stamped ${shown}, not ${commit}, the commit this check was given.`
    return undefined
  } finally {
    await context.close()
  }
}

async function main(): Promise<void> {
  let values: {
    project?: boolean
    sha?: string
    url?: string[]
    'wrangler-output'?: string
    attempts?: string
  }
  try {
    values = parseArgs({
      options: {
        project: { type: 'boolean' },
        sha: { type: 'string' },
        url: { type: 'string', multiple: true },
        'wrangler-output': { type: 'string' },
        attempts: { type: 'string' },
      },
      strict: true,
      allowPositionals: false,
    }).values
  } catch (error) {
    return fail(`${error instanceof Error ? error.message : String(error)}\n${USAGE}`)
  }

  const env: Partial<Record<(typeof ENV_NAMES)[number], string>> = {}
  const unset = ENV_NAMES.filter((name) => {
    const value = (process.env[name] ?? '').trim()
    if (value !== '') env[name] = value
    return value === ''
  })
  if (unset.length > 0)
    return fail(`Not set: ${unset.join(', ')}. The check reads them from the environment.`)
  const supabaseUrl = env.VITE_SUPABASE_URL ?? ''
  const key = env.VITE_SUPABASE_ANON_KEY ?? ''

  if (values.project) {
    if (values.sha !== undefined || values.url !== undefined || values['wrangler-output'] !== undefined) {
      return fail(`--project checks the project only, and takes no other option.\n${USAGE}`)
    }
  } else {
    if (!/^[0-9a-f]{7,40}$/.test(values.sha ?? '')) return fail(`--sha must be a commit SHA.\n${USAGE}`)
    if ((values.url === undefined) === (values['wrangler-output'] === undefined)) {
      return fail(`Give --url or --wrangler-output, not both and not neither.\n${USAGE}`)
    }
  }
  const attempts = Number(values.attempts ?? '3')
  if (!Number.isInteger(attempts) || attempts < 1)
    return fail(`--attempts must be a whole number from 1.\n${USAGE}`)

  let urls: string[] = values.url ?? []
  const outputFile = values['wrangler-output']
  if (outputFile !== undefined) {
    try {
      urls = deployedUrls(outputFile)
    } catch (error) {
      return fail(`Could not read wrangler's output, ${outputFile}: ${String(error)}`)
    }
    if (urls.length === 0) return fail(`Wrangler's output, ${outputFile}, names no deployed URL.`)
  }

  const project = await projectProblem(supabaseUrl, key)
  if (project !== undefined) return fail(project)
  console.log(`The Supabase project at ${supabaseUrl} is up.`)
  if (values.project) return

  const commit = (values.sha ?? '').slice(0, 7)
  const browser = await chromium.launch()
  try {
    for (const url of urls) {
      let problem: string | undefined
      for (let attempt = 1; attempt <= attempts; attempt += 1) {
        problem = await pageProblem(browser, url, commit)
        if (problem === undefined) break
        if (attempt < attempts) {
          console.log(`Attempt ${attempt} of ${attempts}: ${problem} Loading it again in 10 s.`)
          await sleep(RETRY_WAIT_MS)
        }
      }
      if (problem !== undefined) return fail(problem)
      console.log(`${url} started, stamped ${commit}.`)
    }
  } finally {
    await browser.close()
  }
}

await main()

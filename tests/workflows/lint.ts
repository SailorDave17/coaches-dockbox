// The workflow lint (#38), run by tests/unit/workflows.test.ts. Two questions about .github/workflows:
//
// lintWorkflow, for every workflow: no job a pull request can run reads a secret, deploys to an
// environment or runs a production command, Dependabot's pull requests included (they get no secrets
// at all, so a job that needs one fails on every dependency bump). And every secret, wherever it is
// read, travels by name only: `NAME: ${{ secrets.NAME }}` under an env:, never interpolated into a
// script or an action's inputs, and no script traces or echoes it.
//
// releasePipelineProblems, for ci.yml: the deploy job is the one job that reads a secret, runs on a
// push to release and nothing else, after both checks, in the production environment, with no step
// that runs past a failure, in the order the issue sets: check every secret and variable is set,
// refuse a paused project, apply the migrations, deploy the functions, deploy the Worker, check the
// served page. The build reads its public values from Actions variables. It installs with no install
// scripts and leaves no GitHub token in .git/config, because its later steps hold the production
// tokens (security audit on #38). A pull request's run proves the Worker's config with a dry run and
// lints the workflows with actionlint.
//
// Both return problems as sentences, empty when there are none. A job "a pull request can run" is
// any job in a workflow triggered by pull_request, pull_request_target or workflow_run (which a pull
// request's own run can trigger, with the base branch's secrets), unless its `if:` is exactly
// RELEASE_PUSH. Any other condition counts as runnable, because a lint cannot evaluate expressions
// and must fail toward the stricter answer. A job calling a reusable workflow with `secrets: inherit`
// reads every secret.

export const RELEASE_PUSH = "github.event_name == 'push' && github.ref == 'refs/heads/release'"

const PULL_REQUEST_EVENTS = ['pull_request', 'pull_request_target', 'workflow_run']

// What secretsRead reports for `secrets: inherit`.
const EVERY_SECRET = '* (secrets: inherit)'

// Commands that write to the live project or the live Worker. A dry run writes nothing.
const PRODUCTION_COMMANDS: readonly RegExp[] = [
  /\bsupabase\s+link\b/,
  /\bsupabase\s+db\s+push\b/,
  /\bsupabase\s+functions\s+deploy\b/,
  /\bsupabase\s+secrets\s+set\b/,
  /--linked\b/,
  /\bwrangler\s+(?:deploy|versions\s+upload|secret\s+put)\b(?![^\n]*--dry-run)/,
]

const SECRET_REFERENCE = /\bsecrets(?:\.([A-Za-z_][A-Za-z0-9_]*)|\s*\[)/g
const BY_NAME = /^\$\{\{\s*secrets\.([A-Za-z_][A-Za-z0-9_]*)\s*\}\}$/

type Mapping = Record<string, unknown>

export interface Step {
  name?: string
  run?: string
  uses?: string
  with?: Mapping
  if?: unknown
  env?: Mapping
  'continue-on-error'?: unknown
}

export interface Job {
  if?: unknown
  needs?: unknown
  environment?: unknown
  env?: Mapping
  uses?: string
  secrets?: unknown
  steps?: Step[]
  'continue-on-error'?: unknown
}

export interface Workflow {
  on?: unknown
  env?: Mapping
  jobs?: Record<string, Job>
}

function isMapping(value: unknown): value is Mapping {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function triggers(workflow: Workflow): string[] {
  const on = workflow.on
  if (typeof on === 'string') return [on]
  if (Array.isArray(on)) return on.filter((event): event is string => typeof event === 'string')
  return isMapping(on) ? Object.keys(on) : []
}

/** A job's `if:` with any ${{ }} wrapper removed and its spaces collapsed. */
export function condition(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value
    .trim()
    .replace(/^\$\{\{([\s\S]*)\}\}$/, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

export function pullRequestCanRun(workflow: Workflow, job: Job): boolean {
  if (!triggers(workflow).some((event) => PULL_REQUEST_EVENTS.includes(event))) return false
  return condition(job.if) !== RELEASE_PUSH
}

/** Every string in a YAML tree, with the path of keys that leads to it. */
function strings(value: unknown, path: string[] = []): { path: string[]; text: string }[] {
  if (typeof value === 'string') return [{ path, text: value }]
  if (Array.isArray(value)) return value.flatMap((item, index) => strings(item, [...path, String(index)]))
  if (isMapping(value)) return Object.entries(value).flatMap(([key, item]) => strings(item, [...path, key]))
  return []
}

function secretNames(text: string): string[] {
  return [...text.matchAll(SECRET_REFERENCE)].map((match) => match[1] ?? '[…]')
}

/** The secrets a job reads, the workflow's own env: included, GITHUB_TOKEN excepted. */
export function secretsRead(workflow: Workflow, job: Job): string[] {
  const names = [...strings(workflow.env), ...strings(job)].flatMap(({ text }) => secretNames(text))
  if (job.secrets === 'inherit') names.push(EVERY_SECRET)
  return [...new Set(names)].filter((name) => name !== 'GITHUB_TOKEN')
}

function environmentName(job: Job): string | undefined {
  if (typeof job.environment === 'string') return job.environment
  if (isMapping(job.environment) && typeof job.environment.name === 'string') return job.environment.name
  return undefined
}

function productionCommands(job: Job): string[] {
  return (job.steps ?? []).flatMap((step) =>
    PRODUCTION_COMMANDS.flatMap((command) => {
      const match = command.exec(step.run ?? '')
      return match ? [match[0]] : []
    }),
  )
}

/** Names that hold a secret in this step's env:, the job's or the workflow's. */
function secretEnvNames(...envs: (Mapping | undefined)[]): string[] {
  return envs.flatMap((env) =>
    Object.entries(env ?? {})
      .filter(([, value]) => typeof value === 'string' && secretNames(value).length > 0)
      .map(([key]) => key),
  )
}

export function lintWorkflow(file: string, workflow: Workflow): string[] {
  const problems: string[] = []
  for (const [id, job] of Object.entries(workflow.jobs ?? {})) {
    const where = `${file}: job ${id}`
    if (pullRequestCanRun(workflow, job)) {
      for (const name of secretsRead(workflow, job))
        problems.push(`${where} runs on a pull request and reads secrets.${name}`)
      const environment = environmentName(job)
      if (environment !== undefined)
        problems.push(`${where} runs on a pull request and deploys to ${environment}`)
      for (const command of productionCommands(job))
        problems.push(`${where} runs on a pull request and runs \`${command}\``)
    }
    for (const [index, step] of (job.steps ?? []).entries()) {
      const run = step.run ?? ''
      const label = `${where} step ${index + 1}${step.name ? ` (${step.name})` : ''}`
      if (/\bset\s+(?:-[a-wyz]*x|-o\s+xtrace)/.test(run))
        problems.push(`${label} traces its commands with set -x, which prints values`)
      for (const name of secretEnvNames(step.env, job.env, workflow.env)) {
        const printed = new RegExp(`\\b(?:echo|printf)\\b[^\\n]*\\$\\{?${name}\\b`)
        if (printed.test(run)) problems.push(`${label} prints ${name}, which holds a secret`)
      }
    }
  }
  for (const { path, text } of strings(workflow)) {
    for (const name of secretNames(text)) {
      const byName = BY_NAME.exec(text.trim())
      const key = path.at(-1)
      if (path.at(-2) === 'env' && byName?.[1] === name && key === name) continue
      problems.push(
        `${file}: ${path.join('.')} reads secrets.${name} other than as \`${name}: \${{ secrets.${name} }}\` under env:`,
      )
    }
  }
  return problems
}

// The deploy job's steps, each found by what it runs, in the order they must run.
const DEPLOY_ORDER: readonly [string, RegExp][] = [
  ['check every secret and variable is set', /\bnode scripts\/require-env\.ts\b/],
  ['refuse a paused project', /\bcheck:deploy -- --project\b/],
  ['link the live project', /\bsupabase\s+link\b/],
  ['apply the migrations', /\bsupabase\s+db\s+push\b/],
  ['deploy the Edge Functions', /\bsupabase\s+functions\s+deploy\b/],
  ['deploy the Worker', /\bwrangler\s+deploy\b(?![^\n]*--dry-run)/],
  ['check the served page', /\bcheck:deploy -- --sha\b/],
]

const BUILD_VALUES = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']

function stepIndex(job: Job, pattern: RegExp): number {
  return (job.steps ?? []).findIndex((step) => pattern.test(step.run ?? ''))
}

export function releasePipelineProblems(file: string, workflow: Workflow): string[] {
  const problems: string[] = []
  const jobs = workflow.jobs ?? {}
  const readers = Object.keys(jobs).filter((id) => secretsRead(workflow, jobs[id] ?? {}).length > 0)
  if (readers.join() !== 'deploy')
    problems.push(`${file}: the jobs that read a secret are [${readers.join(', ')}], not [deploy]`)
  const deploy = jobs.deploy
  if (deploy === undefined) return [...problems, `${file}: has no deploy job`]

  if (condition(deploy.if) !== RELEASE_PUSH)
    problems.push(`${file}: the deploy job's if: is not \`${RELEASE_PUSH}\``)
  const needs = (Array.isArray(deploy.needs) ? deploy.needs : [deploy.needs]).filter(
    (need) => typeof need === 'string',
  )
  if ([...needs].sort().join() !== 'checks,db-tests') {
    problems.push(`${file}: the deploy job needs [${needs.join(', ')}], not [checks, db-tests]`)
  }
  if (environmentName(deploy) !== 'production')
    problems.push(`${file}: the deploy job is not in the production environment`)

  for (const [index, step] of (deploy.steps ?? []).entries()) {
    const label = `${file}: deploy step ${index + 1}${step.name ? ` (${step.name})` : ''}`
    if (/\bnpm\s+(?:ci|install|i)\b/.test(step.run ?? '') && !/--ignore-scripts\b/.test(step.run ?? '')) {
      problems.push(`${label} installs with install scripts on, in the job that holds the production tokens`)
    }
    if ((step.uses ?? '').startsWith('actions/checkout@') && step.with?.['persist-credentials'] !== false) {
      problems.push(`${label} leaves the job's GitHub token in .git/config (persist-credentials)`)
    }
  }

  if (deploy['continue-on-error'] !== undefined) problems.push(`${file}: the deploy job continues on error`)
  for (const [index, step] of (deploy.steps ?? []).entries()) {
    const label = `${file}: deploy step ${index + 1}${step.name ? ` (${step.name})` : ''}`
    if (step.if !== undefined)
      problems.push(`${label} has an if:, so it can run past a failure or be skipped`)
    if (step['continue-on-error'] !== undefined) problems.push(`${label} continues on error`)
  }

  // Where a command first appears: its step, then its offset in that step's script, since one step
  // may run two of them (link, then db push).
  let previous: [number, number] = [-1, -1]
  for (const [what, pattern] of DEPLOY_ORDER) {
    const step = stepIndex(deploy, pattern)
    const at: [number, number] = [step, pattern.exec(deploy.steps?.[step]?.run ?? '')?.index ?? -1]
    if (step === -1) problems.push(`${file}: the deploy job has no step that does this: ${what}`)
    else if (at[0] < previous[0] || (at[0] === previous[0] && at[1] <= previous[1])) {
      problems.push(`${file}: the deploy job does this out of order: ${what}`)
    } else previous = at
  }

  const read = new Set([
    ...secretsRead(workflow, deploy),
    ...strings(deploy).flatMap(({ text }) =>
      [...text.matchAll(/\bvars\.([A-Za-z_][A-Za-z0-9_]*)/g)].map((m) => m[1] ?? ''),
    ),
  ])
  const checked = new Set(
    (deploy.steps ?? [])
      .flatMap(
        (step) =>
          /\bnode scripts\/require-env\.ts\b(.*)/
            .exec(step.run ?? '')?.[1]
            ?.trim()
            .split(/\s+/) ?? [],
      )
      .filter((name) => name !== ''),
  )
  for (const name of read) {
    if (!checked.has(name))
      problems.push(`${file}: the deploy job reads ${name} and require-env does not check it`)
  }

  const builds = (deploy.steps ?? []).filter((step) => /\bnpm run build\b/.test(step.run ?? ''))
  if (builds.length === 0) problems.push(`${file}: the deploy job does not build`)
  for (const build of builds) {
    for (const name of BUILD_VALUES) {
      const value = build.env?.[name] ?? deploy.env?.[name]
      if (
        typeof value !== 'string' ||
        !new RegExp(`^\\$\\{\\{\\s*vars\\.${name}\\s*\\}\\}$`).test(value.trim())
      ) {
        problems.push(`${file}: the deploy build does not read ${name} from vars.${name}`)
      }
    }
  }

  const pullRequestJobs = Object.values(jobs).filter((job) => pullRequestCanRun(workflow, job))
  const dryRun = pullRequestJobs.some((job) => {
    const built = stepIndex(job, /\bnpm run build\b/)
    const dry = stepIndex(job, /\bwrangler\s+deploy\b[^\n]*--dry-run/)
    return built !== -1 && dry > built
  })
  if (!dryRun)
    problems.push(`${file}: no job a pull request runs builds and then runs wrangler deploy --dry-run`)
  if (!pullRequestJobs.some((job) => stepIndex(job, /\bactionlint\b/) !== -1)) {
    problems.push(`${file}: no job a pull request runs runs actionlint`)
  }
  return problems
}

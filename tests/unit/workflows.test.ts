// The workflow lint (#38, tests/workflows/lint.ts) over this repository's workflows, and its controls.
// Each control is a workflow, or ci.yml with one thing changed, that the lint must refuse for exactly
// the reason planted. Without them a lint that read nothing would pass the real files as well.
import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { lintWorkflow, releasePipelineProblems, RELEASE_PUSH, type Workflow } from '../workflows/lint.ts'

const dir = new URL('../../.github/workflows/', import.meta.url)
const files = readdirSync(dir).filter((file) => /\.ya?ml$/.test(file))
const read = (file: string) => parse(readFileSync(new URL(file, dir), 'utf8')) as Workflow
const ci = () => read('ci.yml')

/** A one-job workflow from its parts, for the controls. */
function workflow(on: unknown, job: Record<string, unknown>): Workflow {
  return { on, jobs: { planted: job } } as Workflow
}

const steps = (...runs: string[]) => runs.map((run) => ({ run }))

describe("this repository's workflows", () => {
  it('include ci.yml, so the lint below read something', () => {
    expect(files).toContain('ci.yml')
  })

  it.each(files)('%s: no job a pull request runs reads a secret, and secrets travel by name only', (file) => {
    expect(lintWorkflow(file, read(file))).toEqual([])
  })

  it("ci.yml: the deploy job has the release pipeline's shape, and pull requests dry-run and lint", () => {
    expect(releasePipelineProblems('ci.yml', ci())).toEqual([])
  })
})

describe('the lint refuses each planted fault, and only that one', () => {
  it('a job a pull request runs that reads a secret', () => {
    const planted = workflow(['pull_request', 'push'], {
      env: { TOKEN: '${{ secrets.TOKEN }}' },
      steps: steps('npm test'),
    })
    expect(lintWorkflow('planted.yml', planted)).toEqual([
      'planted.yml: job planted runs on a pull request and reads secrets.TOKEN',
    ])
  })

  it("the same job behind RELEASE_PUSH, which a pull request cannot run, and a push-only workflow's job", () => {
    const behind = workflow('pull_request', {
      if: `\${{ ${RELEASE_PUSH} }}`,
      env: { TOKEN: '${{ secrets.TOKEN }}' },
    })
    expect(lintWorkflow('planted.yml', behind)).toEqual([])
    const pushOnly = workflow({ push: { branches: ['release'] } }, { env: { TOKEN: '${{ secrets.TOKEN }}' } })
    expect(lintWorkflow('planted.yml', pushOnly)).toEqual([])
  })

  it('a condition the lint cannot prove excludes pull requests counts as runnable', () => {
    const planted = workflow('pull_request', {
      if: "github.ref == 'refs/heads/release'",
      env: { TOKEN: '${{ secrets.TOKEN }}' },
    })
    expect(lintWorkflow('planted.yml', planted)).toEqual([
      'planted.yml: job planted runs on a pull request and reads secrets.TOKEN',
    ])
  })

  it('pull_request_target counts as a pull request, and a secret in the workflow env reaches every job', () => {
    const planted = {
      on: { pull_request_target: {} },
      env: { TOKEN: '${{ secrets.TOKEN }}' },
      jobs: { planted: {} },
    }
    expect(lintWorkflow('planted.yml', planted as Workflow)).toEqual([
      'planted.yml: job planted runs on a pull request and reads secrets.TOKEN',
    ])
  })

  it('a job a pull request runs that passes every secret to a reusable workflow', () => {
    const planted = workflow('pull_request', { uses: './.github/workflows/deploy.yml', secrets: 'inherit' })
    expect(lintWorkflow('planted.yml', planted)).toEqual([
      'planted.yml: job planted runs on a pull request and reads secrets.* (secrets: inherit)',
    ])
  })

  it("a workflow_run job, which a pull request's own run can trigger, that reads a secret", () => {
    const planted = workflow(
      { workflow_run: { workflows: ['CI'], types: ['completed'] } },
      { env: { TOKEN: '${{ secrets.TOKEN }}' } },
    )
    expect(lintWorkflow('planted.yml', planted)).toEqual([
      'planted.yml: job planted runs on a pull request and reads secrets.TOKEN',
    ])
  })

  it('a job a pull request runs that deploys to an environment', () => {
    expect(
      lintWorkflow('planted.yml', workflow('pull_request', { environment: { name: 'production' } })),
    ).toEqual(['planted.yml: job planted runs on a pull request and deploys to production'])
  })

  it.each([
    ['npx supabase link --project-ref x', 'supabase link'],
    ['npx supabase db push --yes', 'supabase db push'],
    ['npx supabase functions deploy --use-api', 'supabase functions deploy'],
    ['npx supabase migration list --linked', '--linked'],
    ['npx wrangler deploy', 'wrangler deploy'],
  ])('a job a pull request runs that runs `%s`', (run, command) => {
    expect(lintWorkflow('planted.yml', workflow('pull_request', { steps: steps(run) }))).toEqual([
      `planted.yml: job planted runs on a pull request and runs \`${command}\``,
    ])
  })

  it('a dry run, which writes nothing, is not a production command', () => {
    expect(
      lintWorkflow(
        'planted.yml',
        workflow('pull_request', { steps: steps('npx wrangler deploy --dry-run') }),
      ),
    ).toEqual([])
  })

  it.each([
    [
      'interpolated into a script',
      { steps: [{ run: 'deploy "${{ secrets.TOKEN }}"' }] },
      'jobs.planted.steps.0.run',
    ],
    [
      'passed to an action',
      { steps: [{ uses: 'x/y@v1', with: { token: '${{ secrets.TOKEN }}' } }] },
      'jobs.planted.steps.0.with.token',
    ],
    [
      'under another name',
      { steps: [{ env: { KEY: '${{ secrets.TOKEN }}' } }] },
      'jobs.planted.steps.0.env.KEY',
    ],
    ['inside a longer value', { env: { TOKEN: 'Bearer ${{ secrets.TOKEN }}' } }, 'jobs.planted.env.TOKEN'],
  ])('a secret read %s', (_name, job, path) => {
    expect(lintWorkflow('planted.yml', workflow('push', job))).toEqual([
      `planted.yml: ${path} reads secrets.TOKEN other than as \`TOKEN: \${{ secrets.TOKEN }}\` under env:`,
    ])
  })

  it.each([
    ['echo "$TOKEN"', 'prints TOKEN, which holds a secret'],
    ['printf %s "${TOKEN}" > out', 'prints TOKEN, which holds a secret'],
    ['set -eux\ndeploy', 'traces its commands with set -x, which prints values'],
    ['set -o xtrace', 'traces its commands with set -x, which prints values'],
  ])('a step that runs `%s`', (run, problem) => {
    const planted = workflow('push', { steps: [{ env: { TOKEN: '${{ secrets.TOKEN }}' }, run }] })
    expect(lintWorkflow('planted.yml', planted)).toEqual([`planted.yml: job planted step 1 ${problem}`])
  })
})

describe('the release pipeline check refuses each planted change to ci.yml, and only that one', () => {
  /** ci.yml with its deploy job changed by `change`. */
  function changed(change: (deploy: NonNullable<NonNullable<Workflow['jobs']>['deploy']>) => void): Workflow {
    const planted = ci()
    const deploy = planted.jobs?.deploy
    if (!deploy) throw new Error('ci.yml has no deploy job')
    change(deploy)
    return planted
  }
  const stepRunning = (pattern: RegExp) => (job: { steps?: { run?: string }[] }) =>
    (job.steps ?? []).findIndex((step) => pattern.test(step.run ?? ''))

  it('the deploy job with no if:, which a pull request would then run', () => {
    const planted = changed((deploy) => delete deploy.if)
    expect(releasePipelineProblems('ci.yml', planted)).toEqual([
      `ci.yml: the deploy job's if: is not \`${RELEASE_PUSH}\``,
    ])
    expect(lintWorkflow('ci.yml', planted)).toEqual(
      expect.arrayContaining([
        'ci.yml: job deploy runs on a pull request and reads secrets.SUPABASE_ACCESS_TOKEN',
      ]),
    )
  })

  it('the deploy job needing one check only', () => {
    expect(
      releasePipelineProblems(
        'ci.yml',
        changed((deploy) => (deploy.needs = ['checks'])),
      ),
    ).toEqual(['ci.yml: the deploy job needs [checks], not [checks, db-tests]'])
  })

  it('the deploy job outside the production environment', () => {
    expect(
      releasePipelineProblems(
        'ci.yml',
        changed((deploy) => delete deploy.environment),
      ),
    ).toEqual(['ci.yml: the deploy job is not in the production environment'])
  })

  it('a deploy step that would run past a failure', () => {
    const planted = changed((deploy) => {
      const worker = stepRunning(/wrangler deploy/)(deploy)
      const step = deploy.steps?.[worker]
      if (step) step.if = '${{ !cancelled() }}'
    })
    expect(releasePipelineProblems('ci.yml', planted)).toEqual([
      expect.stringMatching(
        /^ci\.yml: deploy step \d+ \(Deploy the Worker\) has an if:, so it can run past a failure/,
      ),
    ])
  })

  it('the Worker deployed before the migrations are applied', () => {
    const planted = changed((deploy) => {
      const all = deploy.steps ?? []
      const worker = stepRunning(/wrangler deploy/)(deploy)
      const [step] = all.splice(worker, 1)
      if (step) all.splice(stepRunning(/supabase\s+link/)(deploy), 0, step)
    })
    expect(releasePipelineProblems('ci.yml', planted)).toEqual([
      'ci.yml: the deploy job does this out of order: deploy the Worker',
    ])
  })

  it('no post-deploy check', () => {
    const planted = changed((deploy) => {
      deploy.steps = (deploy.steps ?? []).filter((step) => !/check:deploy -- --sha/.test(step.run ?? ''))
    })
    expect(releasePipelineProblems('ci.yml', planted)).toEqual([
      'ci.yml: the deploy job has no step that does this: check the served page',
    ])
  })

  it('no post-deploy secrets check (#41)', () => {
    const planted = changed((deploy) => {
      deploy.steps = (deploy.steps ?? []).filter((step) => !/check:secrets/.test(step.run ?? ''))
    })
    expect(releasePipelineProblems('ci.yml', planted)).toEqual([
      "ci.yml: the deploy job has no step that does this: check the cron-driven functions' secrets",
    ])
  })

  it('the secrets check before the served page is checked', () => {
    const planted = changed((deploy) => {
      const all = deploy.steps ?? []
      const [step] = all.splice(stepRunning(/check:secrets/)(deploy), 1)
      if (step) all.splice(stepRunning(/check:deploy -- --sha/)(deploy), 0, step)
    })
    expect(releasePipelineProblems('ci.yml', planted)).toEqual([
      "ci.yml: the deploy job does this out of order: check the cron-driven functions' secrets",
    ])
  })

  it('a secret the job reads that require-env does not check', () => {
    const planted = changed((deploy) => {
      const step = deploy.steps?.[stepRunning(/require-env/)(deploy)]
      if (step) step.run = (step.run ?? '').replace(' CLOUDFLARE_ACCOUNT_ID', '')
    })
    expect(releasePipelineProblems('ci.yml', planted)).toEqual([
      'ci.yml: the deploy job reads CLOUDFLARE_ACCOUNT_ID and require-env does not check it',
    ])
  })

  it('a build value written into the workflow instead of read from vars', () => {
    const planted = changed((deploy) => {
      const step = deploy.steps?.[stepRunning(/npm run build/)(deploy)]
      if (step?.env) step.env.VITE_SUPABASE_URL = 'https://example.test'
    })
    expect(releasePipelineProblems('ci.yml', planted)).toEqual([
      'ci.yml: the deploy build does not read VITE_SUPABASE_URL from vars.VITE_SUPABASE_URL',
    ])
  })

  it('a second job that reads a secret', () => {
    const planted = ci()
    const checks = planted.jobs?.checks
    if (checks) checks.env = { TOKEN: '${{ secrets.TOKEN }}' }
    expect(releasePipelineProblems('ci.yml', planted)).toEqual([
      'ci.yml: the jobs that read a secret are [checks, deploy], not [deploy]',
    ])
  })

  it('the deploy job installing with install scripts on', () => {
    const planted = changed((deploy) => {
      const step = deploy.steps?.[stepRunning(/\bnpm ci\b/)(deploy)]
      if (step) step.run = 'npm ci'
    })
    expect(releasePipelineProblems('ci.yml', planted)).toEqual([
      expect.stringMatching(
        /^ci\.yml: deploy step \d+ installs with install scripts on, in the job that holds the production tokens$/,
      ),
    ])
  })

  it("the deploy job's checkout keeping the job's GitHub token", () => {
    const planted = changed((deploy) => {
      const step = deploy.steps?.find((candidate) => (candidate.uses ?? '').startsWith('actions/checkout@'))
      if (step?.with) delete step.with['persist-credentials']
    })
    expect(releasePipelineProblems('ci.yml', planted)).toEqual([
      "ci.yml: deploy step 1 leaves the job's GitHub token in .git/config (persist-credentials)",
    ])
  })

  it.each([
    [
      /wrangler deploy --dry-run/,
      'ci.yml: no job a pull request runs builds and then runs wrangler deploy --dry-run',
    ],
    [/actionlint/, 'ci.yml: no job a pull request runs runs actionlint'],
  ])('the checks job without the step that runs %s', (pattern, problem) => {
    const planted = ci()
    const checks = planted.jobs?.checks
    if (checks) checks.steps = (checks.steps ?? []).filter((step) => !pattern.test(step.run ?? ''))
    expect(releasePipelineProblems('ci.yml', planted)).toEqual([problem])
  })
})

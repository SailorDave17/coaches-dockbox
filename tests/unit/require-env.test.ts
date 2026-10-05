// The deploy job's first step (#38): a secret or variable that was never set reaches the job as an
// empty string, and scripts/require-env.ts must stop the job naming every one, before anything reaches
// production, without printing a value. It runs as the workflow runs it, `node scripts/require-env.ts`.
import { execFile } from 'node:child_process'
import { describe, expect, it } from 'vitest'

interface Run {
  code: number | null
  stdout: string
  stderr: string
}

const NAMES = ['DOCKBOX_TEST_ONE', 'DOCKBOX_TEST_TWO', 'DOCKBOX_TEST_THREE'] as const
// A value no message may print. Each name is set to it, with the name in it, so a printed value
// would be told apart from a printed name.
const value = (name: string) => `planted-value-of-${name.toLowerCase()}`

/** Runs the script naming all three, with exactly `env` set of them. */
function requireEnv(env: Partial<Record<(typeof NAMES)[number], string>>, names: readonly string[] = NAMES) {
  const childEnv: NodeJS.ProcessEnv = { ...process.env }
  for (const name of NAMES) delete childEnv[name]
  return new Promise<Run>((resolve) => {
    execFile(
      process.execPath,
      ['scripts/require-env.ts', ...names],
      { env: { ...childEnv, ...env } },
      (error, stdout, stderr) => {
        const code = error ? (typeof error.code === 'number' ? error.code : null) : 0
        resolve({ code, stdout, stderr })
      },
    )
  })
}

describe('require-env', () => {
  it('passes when every name is set, and prints the names, not the values', async () => {
    const run = await requireEnv(Object.fromEntries(NAMES.map((name) => [name, value(name)])))
    expect(run.code).toBe(0)
    expect(run.stdout).toBe(`Set: ${NAMES.join(', ')}\n`)
    expect(run.stderr).toBe('')
  })

  it('stops naming the one name that is unset', async () => {
    const run = await requireEnv({ DOCKBOX_TEST_ONE: value('one'), DOCKBOX_TEST_THREE: value('three') })
    expect(run.code).toBe(1)
    expect(run.stderr).toMatch(/^Not set: DOCKBOX_TEST_TWO\. /)
    expect(run.stdout).toBe('')
  })

  it('stops naming every unset name in one message, in the order given', async () => {
    const run = await requireEnv({ DOCKBOX_TEST_TWO: value('two') })
    expect(run.code).toBe(1)
    expect(run.stderr).toMatch(/^Not set: DOCKBOX_TEST_ONE, DOCKBOX_TEST_THREE\. /)
  })

  it('counts a blank value as unset, which is what GitHub passes for a secret never added', async () => {
    const run = await requireEnv({
      DOCKBOX_TEST_ONE: '',
      DOCKBOX_TEST_TWO: '  ',
      DOCKBOX_TEST_THREE: value('three'),
    })
    expect(run.code).toBe(1)
    expect(run.stderr).toMatch(/^Not set: DOCKBOX_TEST_ONE, DOCKBOX_TEST_TWO\. /)
  })

  it('never prints a value it was given, on a pass or a refusal', async () => {
    const set = {
      DOCKBOX_TEST_ONE: value('DOCKBOX_TEST_ONE'),
      DOCKBOX_TEST_THREE: value('DOCKBOX_TEST_THREE'),
    }
    const run = await requireEnv(set)
    expect(run.code).toBe(1)
    for (const planted of Object.values(set)) expect(run.stdout + run.stderr).not.toContain(planted)
  })

  it('refuses to run with no names, rather than passing having checked nothing', async () => {
    const run = await requireEnv({}, [])
    expect(run.code).toBe(1)
    expect(run.stderr).toMatch(/^usage: /)
  })
})

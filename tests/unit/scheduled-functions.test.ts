// The cron-driven functions (#41) are named in three places that must agree: the list in
// supabase/functions/_shared/scheduled.ts, the gateway settings in supabase/config.toml, and each
// function's own index.ts. A function the list names but config.toml still has the gateway check a
// JWT for is refused at the gateway on every cron call, before it can check the cron secret. A
// function that turns the check off without being listed escapes the post-deploy secrets check and
// serves anyone. The cron jobs that call the list are matched against it in
// tests/db/scheduled-jobs.test.ts, which reads cron.job.
//
// config.toml is read line by line, as tests/unit/auth-config.test.ts reads it.
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { SCHEDULED } from '../../supabase/functions/_shared/scheduled.ts'

const toml = readFileSync(new URL('../../supabase/config.toml', import.meta.url), 'utf8')
const functionsDir = new URL('../../supabase/functions/', import.meta.url)

/** Each [functions.<name>] section's uncommented `key = value` lines. */
function functionSections(): Record<string, Record<string, string>> {
  const sections: Record<string, Record<string, string>> = {}
  let current: Record<string, string> | undefined
  for (const line of toml.split(/\r?\n/)) {
    const header = /^\[([^\]]+)\]\s*$/.exec(line)
    if (header) {
      const name = /^functions\.([a-z0-9_-]+)$/.exec(header[1] ?? '')?.[1]
      current = name === undefined ? undefined : (sections[name] = {})
      continue
    }
    const pair = /^([a-z_]+)\s*=\s*(.+?)\s*$/.exec(line)
    if (current && pair) current[pair[1] as string] = pair[2] as string
  }
  return sections
}

/** The cron secret's line under [edge_runtime.secrets], which the local edge runtime is given. */
function edgeRuntimeSecrets(): string[] {
  const lines: string[] = []
  let inside = false
  for (const line of toml.split(/\r?\n/)) {
    const header = /^\[([^\]]+)\]\s*$/.exec(line)
    if (header) {
      inside = header[1] === 'edge_runtime.secrets'
      continue
    }
    if (inside && /^[A-Z_]+\s*=/.test(line)) lines.push(line.trim())
  }
  return lines
}

const jobs = Object.keys(SCHEDULED).sort()

describe('the cron-driven functions (#41)', () => {
  it('are exactly the functions config.toml has the gateway check no JWT for', () => {
    const unchecked = Object.entries(functionSections())
      .filter(([, values]) => values.verify_jwt === 'false')
      .map(([name]) => name)
      .sort()
    expect(jobs.length).toBeGreaterThan(0)
    expect(unchecked).toEqual(jobs)
  })

  it.each(jobs)('%s serves through serveJob under its own name, and through nothing else', (job) => {
    const file = new URL(`${job}/index.ts`, functionsDir)
    expect(existsSync(file), `supabase/functions/${job}/index.ts`).toBe(true)
    const source = readFileSync(file, 'utf8')
    expect(source).toContain(`serveJob('${job}',`)
    expect(source).not.toMatch(/\bDeno\.serve\(/)
  })

  it('gives the local edge runtime the cron secret from the environment, never a value', () => {
    expect(edgeRuntimeSecrets()).toEqual(['CRON_SECRET = "env(CRON_SECRET)"'])
  })
})

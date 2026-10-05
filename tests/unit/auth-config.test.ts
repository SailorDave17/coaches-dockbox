// Local Auth's settings for sign-in by emailed link (#52), read from supabase/config.toml, which the
// local stack and CI's database job both start from. The hosted project's settings are the
// first-deploy verification's, not this file's.
//
// Read line by line rather than with a TOML parser: the file is the CLI's flat template, one
// `key = value` per line, and a parser would be the repo's only use of one.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const toml = readFileSync(new URL('../../supabase/config.toml', import.meta.url), 'utf8')

/** The uncommented `key = value` lines of one [section], values as written. */
function section(name: string): Record<string, string> {
  const values: Record<string, string> = {}
  let inside = false
  for (const line of toml.split(/\r?\n/)) {
    const header = /^\[([^\]]+)\]\s*$/.exec(line)
    if (header) {
      inside = header[1] === name
      continue
    }
    const pair = /^([a-z_]+)\s*=\s*(.+?)\s*$/.exec(line)
    if (inside && pair) values[pair[1] as string] = pair[2] as string
  }
  return values
}

describe('local Auth for sign-in by emailed link (#52)', () => {
  it('has sign-ups off, and sends links back to the dev server', () => {
    const auth = section('auth')
    expect({
      enable_signup: auth.enable_signup,
      site_url: auth.site_url,
      additional_redirect_urls: auth.additional_redirect_urls,
    }).toEqual({
      enable_signup: 'false',
      site_url: '"http://localhost:5173"',
      additional_redirect_urls: '["http://localhost:5173"]',
    })
  })

  // The CLI reads [auth.email] enable_signup as whether email sign-in is on at all, so turning it off
  // to stop sign-ups would stop every link too.
  it('keeps email sign-in on', () => {
    expect(section('auth.email').enable_signup).toBe('true')
  })

  it('names the template origin 127.0.0.1:3000 nowhere, commented lines included', () => {
    expect(toml).not.toContain('127.0.0.1:3000')
  })
})

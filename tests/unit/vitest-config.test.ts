// The database tests run one file at a time (#201), read from vitest.config.ts itself.
//
// Supabase's supautils extension makes every `create policy` that postgres runs take an
// AccessExclusiveLock on each table in supautils.policy_grants: auth.users, the other auth tables,
// storage and realtime (measured on CLI 2.118.0, whatever table the policy is on). So
// policy-functions.test.ts's rolled-back probe, beside another file's sign-in or admission, deadlocks
// with GoTrue, which writes auth.users and then a second auth table. That failed the required
// database check on PR #200 and blocked a release deploy (run 37404284791). Files in parallel are
// the precondition, so this holds the setting that removes it.
import { describe, expect, it } from 'vitest'
import config from '../../vitest.config.ts'

/** The inline project named `name`, or undefined when there is none. */
function project(name: string) {
  for (const entry of config.test?.projects ?? []) {
    if (typeof entry === 'object' && 'test' in entry && entry.test?.name === name) return entry.test
  }
  return undefined
}

describe('the database tests (#201)', () => {
  it("run one file at a time, so no file's policy probe overlaps another file's sign-in", () => {
    const db = project('db')
    expect(db, 'vitest.config.ts has no inline project named db').toBeDefined()
    expect(db?.include).toEqual(['tests/db/**/*.test.ts'])
    expect(
      db?.fileParallelism,
      'db files must not run in parallel: a create policy locks auth.users and deadlocks with GoTrue (#201)',
    ).toBe(false)
  })
})

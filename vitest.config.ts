import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          // Runs against a local Supabase started with `npx supabase start` (Docker).
          name: 'db',
          include: ['tests/db/**/*.test.ts'],
          environment: 'node',
          // One file at a time (#201). Supabase's supautils extension makes every `create policy`
          // that postgres runs take an AccessExclusiveLock on each table in supautils.policy_grants:
          // auth.users, the other auth tables, storage and realtime. A file's rolled-back policy
          // probe running beside another file's sign-in or admission deadlocks with GoTrue, which
          // writes auth.users and then a second auth table. tests/unit/vitest-config.test.ts holds it.
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
      {
        test: {
          // Plain Node, no database and no browser: the glare token test (#36).
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],
          environment: 'node',
        },
      },
    ],
  },
})

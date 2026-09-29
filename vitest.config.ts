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
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
})

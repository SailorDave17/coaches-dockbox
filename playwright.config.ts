import { defineConfig, devices } from '@playwright/test'

// Screen tests (#36): Chromium against the built app, which `vite preview` serves from dist/. Build
// first. CI's checks job does, with placeholder public values, because config.ts stops the app at
// load without them.
const port = 4173

export default defineConfig({
  testDir: 'tests/screens',
  forbidOnly: !!process.env.CI,
  // An accessibility failure that passes on a retry is still a failure.
  retries: 0,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: { baseURL: `http://127.0.0.1:${port}` },
  projects: [
    {
      name: 'chromium',
      // A phone, since the dock is one: the smaller size the design-bar prototype was measured at
      // (discovery log, 2026-09-29). A story that needs another size sets its own.
      use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 667 } },
    },
  ],
  webServer: {
    // strictPort and no reuse: a port held by anything else fails the run instead of testing it.
    command: `npm run preview -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
  },
})

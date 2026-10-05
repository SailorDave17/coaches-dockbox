// Builds the throwaway device probe (#31) on its own: `npm run probe:build`. The app's build reads the
// root vite.config.ts and never this file, and nothing under src/ imports the probe, so `npm run build`
// produces the same bundle with or without it.
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  // Relative to root, so the probe's output never lands in (or empties) the app's dist/.
  build: { outDir: 'dist', emptyOutDir: true },
  // A visible build stamp: a service worker keeps serving the build it cached, so a phone can be
  // reading an older probe than the one just deployed, and only this shows it.
  define: { __PROBE_BUILT_AT__: JSON.stringify(new Date().toISOString()) },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      // injectRegister is left unset on purpose. src/main.ts imports virtual:pwa-register (to show when
      // the probe is ready to work offline), which already stops the plugin injecting a second
      // registration; setting it to false would also drop skipWaiting and clientsClaim from the
      // worker (cairn memory: vite-plugin-pwa-autoupdate-ships-no-reload).
      manifest: {
        name: 'Dockbox device probe',
        short_name: 'Probe',
        description: 'Throwaway capability probe for Coach’s Dockbox (#31). Not the app.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#f5f9fc',
        theme_color: '#3e4369',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,webmanifest}'],
        navigateFallback: 'index.html',
      },
    }),
  ],
})

# Device probe — throwaway (#31)

One page that measures, on the phone running it, what the coach app's shape rests on (ADR 005, ADR 007):

- a platform passkey with user verification (UV) required, reporting the UV flag and the AAGUID;
- the card-cache key: a non-extractable AES-GCM key derived from the passkey's PRF output, or, where PRF
  is unsupported, the weaker fallback (a stored non-extractable key the page releases only after a
  user-verified assertion);
- offline service from its own service worker (vite-plugin-pwa);
- the screen wake lock, re-acquired when the page is shown again;
- `tel:` and `sms:` links to an invented 555 number as single tap targets of at least 56 px.

The reading on real phones is #37. The key path that reading selects is recorded in ADR 005 there, and
the card-cache stories (#93, #113) build on it. **Delete this directory once they no longer need it.**

## Not the app

Nothing under `src/` imports this, and the app's build never reads `vite.config.ts` here, so `npm run
build` produces the same bundle with or without it (measured by sha256 against `develop` when it was
added). Lint, format and `npm run typecheck` do cover it: the root `tsconfig.json` references it.
Nothing runs it in CI and nothing deploys it. It can rot, which is acceptable because what matters is
the recorded reading, not the code.

Every name, number and card on the page is invented. The JSON it copies out holds the user agent and
each row's flags, sizes and states: no credential id, no user handle, no card content.

## Commands

| Script | Does |
|---|---|
| `npm run probe:dev` | Vite dev server for the probe (no service worker in dev) |
| `npm run probe:build` | Type-check the probe and build it to `spikes/device-probe/dist/` |
| `npm run probe:preview -- --port 4317` | Serve the build, service worker included |

A passkey needs a secure context. `localhost` is one, so the probe runs on this machine as is. A phone
needs HTTPS, which is why #37 deploys `dist/` as its own throwaway Worker; this story deployed nothing.

## Reading it on a phone

1. Open it and wait for **Offline ready: yes** at the top.
2. **Create passkey** once. Creating again replaces the passkey (the invented user handle is fixed),
   and a card sealed under the old one will not open: row 4 then says "not the key that sealed this
   card".
3. **Use passkey**, then **Seal the card**. Where PRF is unsupported, row 3 says so and row 5 seals
   with the fallback key by itself.
4. **Reload page**, then **Open the card** (row 4), or **Unlock and open** (row 6) on the fallback
   path. Opening in the same page load reads NOT YET: it proves nothing about a reload.
5. Turn on airplane mode and reopen the probe: reload the tab, or swipe the installed app away and
   open it again. Row 7 passes only when the network is really gone and the service worker served the
   page. Run rows 2 and 4 (or 6) again.
6. **Hold / release the screen lock**; switch away and back. The clock shows the held time and the row
   counts re-acquisitions.
7. Tap **Call** and **Text**. Whether each opened directly or asked first is not something the page
   can see: write it beside the JSON.
8. **Copy results as JSON** and paste it into the reading issue.

**Clear probe data** removes what the probe stored. The passkey stays on the phone until it is deleted
in the phone's password settings.

## What the desktop session run measured (2026-09-30)

Desktop Chrome 153 on Windows, driven by `playwright-core` with a CDP virtual authenticator
(`WebAuthn.addVirtualAuthenticator`: `ctap2`, `internal`, resident key, UV, `isUserVerified: true`,
`hasPrf` true then false):

- **PRF on**: create, assert, seal and open after a reload all pass; opening in the same load reads
  NOT YET. The fallback rows are skipped.
- **PRF off**: both PRF rows report unsupported, the fallback seals by itself, and the fallback opens
  after a reload. With UV made to fail (`WebAuthn.setUserVerified`), Chrome refused the ceremony
  (`NotAllowedError`) and the key was never released.
- **Offline**: with the context offline, the reload was served by the service worker (row 7 passes),
  and every crypto row ran, including a whole seal, reload and open cycle. `navigator.onLine` stayed
  `true` throughout, which is why row 7 reads the network with a request instead.
- **Wake lock**: headless Chrome refuses it, and Playwright keeps its pages visible, so neither can
  show the re-acquire. It was measured in Chrome with a throwaway profile, driven over raw CDP. A
  real tab switch hid the page, Chrome released the lock, and returning re-acquired it
  (`reacquiredOnVisibilityChange: 1`).
- **Links**: both 259 × 72 px at the default desktop viewport, and a tap at each centre reaches the
  link.
- **AAGUID**: the virtual authenticator's `01020304-0506-0708-0102-030405060708`, not zeroed under
  `attestation: 'none'`. A phone's AAGUID names its passkey provider; all zeros means the browser hid
  it.

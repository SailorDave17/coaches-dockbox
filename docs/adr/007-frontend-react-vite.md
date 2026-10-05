# ADR 007 — React + TypeScript + Vite PWA
- Status: accepted 2026-09-29 (charter ratified) · Phase 6
- **Context**: salvage cohssa-attendance's attendance screen, `grades.js` and `dates.js`; the owner's
  Taskr stack.
- **Options** (*measured* npm registry, 2026-09-29): **React 19.3 + Vite 8.3 + vite-plugin-pwa 1.3**;
  **Next.js** (OpenNext on Workers; SSR buys nothing behind sign-in); **SvelteKit** (new to the owner,
  no salvage).
- **Decision**: React + TypeScript + Vite.
- **Consequences**: TypeScript 7.0 (the Go compiler) is current — tooling compatibility is decided at
  scaffold.
- **Ceiling and next move**: not load-bound.
- **Kill condition**: vite-plugin-pwa cannot produce a service worker that serves the offline card cache
  correctly on iOS.

## Scaffold note (2026-09-29)

Vite's current `react-ts` template (create-vite, fetched at scaffold) pins `typescript ~6.0.2`, so the scaffold uses **TypeScript 6.0.3** — the 6.x fallback this ADR named for the TypeScript 7 compatibility question. Not a reopening: the ADR deferred exactly this choice to the scaffold. The template's `tsconfig` had no `strict`; ADR 011 turns it on (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`). `vite-plugin-pwa` is left to the installability story (ADR 005) rather than added untested against Vite 8 on day one.

**Amended 2026-09-30 (#26).** **TypeScript 7.0.2** has been the version on `develop` since
Dependabot #2 merged on 2026-09-29 (`package.json`: `typescript ~7.0.2`), and the owner kept it
(backlog decision D4). The 6.0.3 above is what the scaffold shipped, not what the checks run on: do not pin
back to it. *Measured* in CI run 36657679343, on that merge commit: lint (oxlint), format
(Prettier), typecheck (`tsc -b`, with ADR 011's strict flags on) and build all passed on 7.0.2, which
answers the TypeScript 7 compatibility question this ADR deferred to the scaffold. That run's other
job, the database test, failed before any test ran because the local Supabase never started (an
image pull refused with `toomanyrequests`, #27). That job passed on 7.0.2 at run 36726856023.

**Amended 2026-09-30 (#31).** **vite-plugin-pwa 1.3.0** arrived as a devDependency with the
throwaway device probe in `spikes/device-probe/`. That is its first use against Vite 8 here: its
peer range includes Vite 8, and on Vite 8.3.1 it built the probe's service worker (Workbox 7.4.1,
`generateSW`, `autoUpdate`). *Measured* in a session run of desktop Chrome 153: the worker served the
probe with the network off. Only the probe's own config loads the plugin. `src/` does not import it,
and the app's `npm run build` produced a bundle byte-identical to `develop`'s (all 4 files, by
sha256). The installability story (#42) still decides how the app uses it. This does not answer the
kill condition above, which is about iOS; the real-phone reading is #37.

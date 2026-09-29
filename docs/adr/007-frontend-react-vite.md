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

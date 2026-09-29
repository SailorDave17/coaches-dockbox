# ADR 011 — Day-1 seams
- Status: accepted 2026-09-29 (charter ratified) · Phase 6
- **Decision**: versioned `supabase/migrations/`; one data module per store (`medical/` the sole caller
  of the medical function); one typed env loader per runtime, failing at boot; scheduled work on
  pg_cron → Edge Functions, each idempotent and catch-up-capable; Vite's current layout re-fetched at
  scaffold; strict TypeScript and a linter from the first commit.
- **Ceiling and next move**: none adds a service; they are boundaries sized to ~1,000 families.
- **Kill condition**: code that has already leaned around a seam — fix the seam, not the caller.

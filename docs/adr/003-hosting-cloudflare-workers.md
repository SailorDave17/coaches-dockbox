# ADR 003 — Cloudflare Workers static assets host the app
- Status: accepted 2026-09-29 (charter ratified) · Phase 6
- **Context**: HSC is not personal use; ceiling $40.
- **Options** (*measured* 2026-09-29): **Workers** — static-asset requests free and unlimited, 100k
  dynamic requests/day free, Paid from $5; no commercial restriction found; owner knows Cloudflare.
  **Pages** — known from madcowsailing but "legacy" (cairn note, 2026-09-27). **Vercel** — Hobby is
  "personal, non-commercial"; Pro $20 per seat breaks the ceiling.
- **Decision**: Workers static assets on a new owner-registered domain (8.1).
- **Consequences**: the domain must be a Cloudflare zone; passkeys and Resend bind to it — pick it once.
- **Ceiling and next move**: 100k dynamic requests/day (the app is almost entirely static) → Workers Paid $5.
- **Kill condition**: Cloudflare restricts free-plan use by organisations, or Workers static assets
  cannot serve the PWA's service worker correctly.

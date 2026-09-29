# ADR 001 — Supabase Pro in its own organisation is the backend
- Status: accepted 2026-09-29 (charter ratified) · Phase 6
- **Context**: medical access must be enforced in the database (4.2); magic link + Google sign-in (2.2);
  backups and no idle pause for a seasonal app holding minors' data; ceiling $40/month; the owner's Free
  organisation already holds its two free projects (*reported* 2026-09-23).
- **Options** (*measured* 2026-09-29 unless tagged): **Supabase Pro** — $25/month incl. one Micro, daily
  backups kept 7 days, never paused, spend cap on by default, RLS, Auth, Storage, Edge Functions,
  pg_cron; deep prior use by the owner (cairn notes). **Firebase Blaze** — Firestore free quotas carry
  over, FCM free, rules enforce at the data layer; card required and no spend cap on Firestore / Storage
  (`supabase-org-billing-and-firebase-as-alternative`, 2026-09-23); new to the owner. **Cloudflare
  Workers + D1** — near-free, known from madcowsailing; no database-enforced access, auth built by hand.
- **Decision**: Supabase Pro, in a new organisation so it transfers to HSC whole.
- **Consequences**: $25 of the $40; custom SMTP required (ADR 004); every client read passes RLS, so the
  policies are code with tests (ADR 009).
- **Ceiling and next move**: Micro at ~1,000 families is far under capacity → Small compute when p95
  query latency breaks the <1 s card budget.
- **Kill condition**: Pro pricing moves past the ceiling, or RLS cannot express "coaches of this
  sailor's program" without a security-definer escape → reopen, Firebase as the runner-up.

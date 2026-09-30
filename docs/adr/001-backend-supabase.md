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
- **Amended 2026-09-29 (owner): Free until real data, then Pro.** Backups and no idle pause protect
  data, and until a real sailor's record exists there is none. So the organisation starts on the Free
  plan, in an owner account that still has a free project slot (the main account's two hold Tender and
  Taskr). The target is unchanged. Pro is a plan on the organisation, so the move is an in-place
  upgrade: same project, URL, keys and data, with no migration.
  - **Created 2026-09-29**: organisation "Coach's Dockbox" (Free), project `coachs-dockbox`, ref
    `oygkxgfjbrvddofifrpk`, East US (North Virginia). No GitHub integration, since an active one
    blocks transferring the project to HSC. Security options left at their defaults (Data API on,
    new tables exposed, no automatic-RLS trigger) because the local stack the medical test runs on
    uses the same defaults and the init migration relies on them. Change both sides together or
    neither. Empty until the first release deploy applies the migrations (ADR 008).
  - **Upgrade trigger**: before the first real sailor's record is written (the first roster import),
    and before the restore rehearsal, which needs Pro anyway. Until then the $25 is $0.
  - **Until then**: the project pauses after 7 idle days; restore it from the dashboard. There are no
    backups, so nothing real may be written to it.
  - **While on Free, invite other logins as Developer, not Owner or Administrator**: the free
    two-project limit counts every organisation where a login holds those roles, so an Owner invite
    counts this project against that login's two (`supabase-org-billing-and-firebase-as-alternative`).

# Coach's Dockbox — charter

## Metadata
- Status: ratified 2026-09-29
- Owner: HSCCo (Hoover Sailing Club; JRT program director)
- Forge-idea provenance: run 2026-09-28, verdict *hardened, with one bet*
- Decision log: [`discovery-log.md`](discovery-log.md) — every question, the options offered and the answer, frozen at ratification

## Problem & vision
Hoover Sailing Club's coaches, parents and sailors juggle **too many apps** (*reported*, owner, a
program director): TeamSnap for schedule and messages, a Google Sheet or paper for attendance, scattered
docs for lesson plans, and paper for coach hours. Three programs share the problem — COHSSA high school
sailing, the Hoover Junior Race Team (JRT) and Hoover Learn to Sail (LTS, which has no app today).

Six-month scene (spring 2027): JRT runs on one app. Parents see the schedule, RSVP, get the weather
cancellation, and keep their child's emergency contacts and medical flags current. On the dock a coach
takes attendance with each sailor's emergency card one tap away and opens tonight's lesson plan, which
another coach wrote. Volunteers sign up to tow the trailers to the next regatta.

**Failure metrics** (one season in; each fails the project at the 70% line):
- Other apps are still used for ≥30% of the jobs Dockbox claims.
- Fewer than 70% of families are reachable (push or email verified) by week two.
- Attendance is taken in Dockbox at fewer than 70% of practices.

The 70% line is a failure threshold, not the alert target — a weather cancellation is designed to reach
every family.

## Users & access
- **User types**: coach, program director, treasurer (later, with coach pay), parent/guardian, sailor 13+.
- **Sign-in**: email magic link + Google. No passwords; recovery is the link itself.
- **Sailors**: only 13+ sign in (birth-year gate); parents see for under-13s. Each guardian has their own
  login; a sailor links to any number of guardians; an admin can unlink a guardian.
- **Memberships** are per program and per season; a person can hold several.
- **Medical flags** are visible to the coaches and director of the sailor's program(s) and to the
  sailor's own guardians — nobody else.
- **Scale** (*reported*): year 1 < 100 families, ~10 coaches; design load ~1,000 families, ~100 coaches.
- **Accessibility**: WCAG 2.2 AA plus outdoor-glare contrast (cyan buttons carry dark ink). English only.

## Scope
### Core workflows — JRT pilot (spring 2027)
1. As each sailor arrives, a coach marks them here with one thumb tap (late and excused are derived, not
   chosen); at start time the coach sees who is still missing and reaches a missing sailor's guardian
   in one tap.
2. A coach opens a sailor's emergency card — contacts + medical flags — in one tap from attendance, and
   at an away regatta with no signal from today's cached cards.
3. Parents and sailors see the schedule and RSVP; coaches see who is coming before practice.
4. A director sends an alert (weather cancellation) that reaches every family by push **and** email.
5. Team messages copy guardians automatically; there is no private coach↔minor messaging.
6. Parents keep their child's contacts, birth year, emergency contacts and medical flags current.
7. A coach writes or attaches a lesson plan or resource, shares it with coaches, and per item chooses
   whether sailors see it; the club keeps it when the coach leaves.
8. Parent volunteers sign up to tow a trailer (with its boats) to a regatta, as separate tow-out and
   tow-back slots with dates and times; the volunteer's vehicle and hitch are matched to the trailer;
   the director sees what is still uncovered.
9. The roster arrives from Clubspot (API, or CSV fallback) and directors assign people to programs.

### Later releases
- **Coach pay** — clock in/out at the dock; receipt photos for travel and hotels; director approves;
  treasurer exports approved hours + reimbursements to the payroll service (Gusto/ADP-style).
- **Video & growth** — practice video tagged to sailors; a 13+ sailor's own history of attendance,
  lessons and video.
- **SMS** for urgent alerts — before LTS joins (summer 2027).
- **COHSSA and LTS** onboarding after the pilot.

### Non-goals
- **Payments and registration** — they stay in Clubspot.
- **Regatta scoring and results** — Burgee's job.
- **Running payroll** — Dockbox exports approved hours and receipts; no withholding, deposits or W-2s.
- **Serving other clubs** — HSC only; no multi-club sign-up.

Standing constraint, not optional: **no private coach↔minor messaging** (SafeSport MAAPP).

### Integrations
| Integration | Owner | Limit (as of 2026-09-29) | Failure mode |
|---|---|---|---|
| Clubspot API `camp-registrations` | Clubspot; key requested by another HSC admin | by request, club-scoped, server-side only; read-only; no webhooks; no documented rate limit | key never arrives → CSV fallback from 2027-02-01; poll fails silently → visible "last synced" + health check |
| Resend (Supabase custom SMTP + broadcasts) | owner's Resend team | 100 transactional/day, 3,000/month; broadcasts unlimited to ≤1,000 contacts | links or alerts land in spam; the daily cap on onboarding night |
| Web Push (VAPID) | owner | iOS only for home-screen-installed PWAs, iOS 16.4+ | family never installs → email carries them |
| Google Sign-In (via Supabase Auth) | Google | — | optional path; the email link is always available |
| Sentry | owner's Sentry org | 5k errors/month, 1 user | quota exhausted → the health check still emails |
| Payroll service (later) | HSC treasurer | format unconfirmed | export rejected → CSV |

## Data
- **Entities**: club; program; season; person; membership (person × program × season × role); guardian
  link; sailor profile (birth year, grad year, `clubspot_id`); contacts; emergency contacts; **medical
  flags**; consent reference; event; RSVP; attendance mark; alert + per-recipient delivery; message;
  lesson plan / resource; trailer; boat; volunteer vehicle; tow slot; Clubspot sync record.
- **Medical flags**: a fixed checklist — severe allergy, carries EpiPen, asthma inhaler, seizures, weak
  swimmer, other — plus one short "what to do" note. No free-form diagnoses or medication lists.
- **Structural control** (the compliance answer, not a promise): the medical table is **denied to every
  client role by RLS**. The only path to it is **one Edge Function** that checks program membership,
  writes a view-log row (who, which sailor, when), decrypts, and returns. Medical fields are encrypted in
  that function with a key held in Edge Function secrets — Supabase's own column encryption (pgsodium /
  TCE) is not used, on Supabase's advice.
- **Ownership**: family-owned — contacts, emergency contacts, medical flags, birth year; club-owned —
  attendance, events, RSVPs, lesson plans, towing.
- **Retention**: medical flags, emergency contacts and birth year are **purged at the end of the
  sailor's last season**; attendance and lesson history stay; the consent reference is kept.
- **Consistency**: tow-slot sign-up is a conditional write — two volunteers can never hold one slot.
  Attendance keeps one taker per practice. Everything else tolerates seconds of staleness.
- **Volume**: ~100 sailors, ~150 guardians, ~10 coaches, ~200 events and ~20k attendance marks a year.

## Non-functional
- **Latency**: attendance taps are optimistic (instant feedback, background save); the emergency card
  opens in < 1 s on mobile data.
- **Offline**: attendance is online-first at Hoover (reliable signal, *reported*); a failed save is held
  and retried. **Emergency cards for today's event are cached** on the coach's device — encrypted with a
  non-extractable key, unlocked by a passkey with user verification (which requires a screen lock),
  wiped after the event and on sign-out.
- **Availability**: if Dockbox is down, a director sends the alert from Resend's dashboard to the synced
  guardian list (one-page runbook).
- **Observability**: failures alert the owner — Sentry for exceptions (PII and medical scrubbed before
  send) and a scheduled health check for failed deliveries, a stale Clubspot sync, or a purge that did
  not run.
- **Load**: spiky on a known calendar (practice evenings, regatta weekends, alert bursts); design load
  ~2,500 recipient-deliveries per alert.

## Stack
| Decision | Choice | ADR |
|---|---|---|
| Backend | Supabase Pro in its own organisation | adr/001-backend-supabase |
| Medical data path | One Edge Function; RLS-denied table; app-level encryption; view log | adr/002-medical-flags-path |
| Hosting | Cloudflare Workers static assets, own domain | adr/003-hosting-cloudflare-workers |
| Email | Resend: custom SMTP for links, broadcasts for alerts | adr/004-email-resend-split |
| App shape | PWA for the pilot; native coach app is the named move | adr/005-app-shape-pwa |
| Alerts | Web Push + email; SMS before LTS | adr/006-alerts-push-email |
| Front end | React + TypeScript + Vite PWA | adr/007-frontend-react-vite |
| Repo, branches, CI/CD | New repo `coachs-dockbox`; develop / release / main; auto-deploy on `release` | adr/008-repo-branches-deploy |
| Testing | First real test: cross-program medical refusal against local Supabase in CI | adr/009-testing |
| Observability | Sentry free + scheduled health check | adr/010-observability |
| Day-1 seams | Migrations, one module per store, typed env, named scheduled work, strict TS + lint | adr/011-day-1-seams |
| Roster source | Clubspot API; CSV fallback from 2027-02-01 | adr/012-roster-clubspot |

## Security & compliance
- **Threats**: opportunistic scanners; a leaked service-role key; a parent's email account taken over;
  a former coach with lingering access; a coach browsing another program's medical flags; a lost phone
  with cached cards; a guardian under a legal contact restriction.
- **Controls**: RLS + the single medical function; season-scoped memberships and one-tap removal by a
  director (wipes cached cards at next sync); passkey-gated, event-scoped card cache; guardian unlink;
  a monthly view-log digest to each director flagging views on non-event days.
- **Secrets**: nothing secret in the repo or the client bundle; the service-role and medical keys live
  only in Edge Function secrets.
- **Dependencies**: Dependabot weekly, grouped for lockstep peers; the owner reviews; no auto-merge.
- **Regulation**: COPPA — outside it by construction (*measured*, FTC FAQ: it applies to data collected
  *from* children; under-13s never sign in). SafeSport MAAPP — enforced by design. HIPAA — not a covered
  entity (*reasoned*). Ohio breach law — recorded unknown; any medical exposure is treated as notifiable.
- **Consent**: HSC's Clubspot registration waiver is believed to cover sharing medical information with
  coaches (*reported*, unverified) — see recorded unknowns.
- **Pre-launch**: cairn `security-audit` plus a second technical reviewer who tries to read a card they
  should not.

## Cost & operations
- **Ceiling**: $40/month; owner-paid through the pilot, then HSC. At pilot ≈ **$26/month** (Supabase Pro
  $25 + domain ~$1; Cloudflare, Resend, Sentry and push free) — as of 2026-09-29.
- **Cliffs** (2026-09-29): Supabase built-in mailer 2 emails/hour → custom SMTP mandatory; Resend 100
  transactional/day → stagger onboarding or Resend Pro $20; Resend broadcasts ≤1,000 contacts; Sentry
  5k errors/month; Workers free 100k dynamic requests/day.
- **Operator**: the owner. Deploys and migrations run automatically on merge to `release`; one restore
  rehearsal before go-live. **On-call**: none; best effort, same day.
- **Handover**: the Supabase org, Cloudflare domain + Workers, Resend team and Sentry project each
  transfer whole to HSC after the pilot.

## What must become true
All four, together in one app — the combination is the ambition:
- **Dock to parent, one tap** — attendance shows who is missing and reaches their guardian or emergency
  card without switching apps.
- **Coaching knowledge stays** — lesson plans (and later video) build a club library that survives coach
  turnover.
- **Paid without paperwork** — clock in at the dock, photograph receipts, the director approves weekly
  (later release).
- **Sailors see their growth** — a sailor's own attendance, lessons and video over time (later release).

Field check (2026-09-29): SailCoach (beta) covers coaching continuity only; Spond and SportEasy cover
team logistics only; nothing found combines operations, coaching and coach pay.

## Signature moment — restated by the owner at design-bar, 2026-09-29
**As each sailor arrives, a coach marks them with one thumb in under 3 seconds without putting anything
down; at start time the screen shows who is still missing, each one tap from their guardian's phone or
emergency card.** It fails if any mark takes over 3 s at a real practice, a tap lands on the wrong
sailor, or a missing sailor's guardian is more than one tap away.

*Superseded wording (ratified at the charter gate the same day)*: "a coach marks the whole JRT roster in
under 60 seconds …". design-bar phase 1 found JRT attendance is **not a roll call** — sailors trickle in
over 15–20 minutes while the coach rigs one-handed in polarized sunglasses, and what follows attendance
is chasing the missing — so the 60-second run measured a moment that does not happen.

## Design bar — set by the owner at design-bar, 2026-09-29
**One thumb, zero decisions.** Big first-name tiles in a stable order that never moves under the thumb;
one tap marks a sailor here. The coach never chooses a status: **late** is derived from the practice
start time, **excused** from the guardian's RSVP; a long-press overrides. At start time the screen
becomes a **still-missing** list, each row one tap from calling or texting the guardian and one tap from
the emergency card. Rejected bars: *kids check themselves in* on a dock tablet (Brightwheel's pattern —
zero coach marking, but hardware, weather and friends tapping each other in); *today's screen, faster*
(P / E / L per row kept — likely correct and inert, since every sailor still costs a decision).

## Forge-idea provenance
- Problem — *reported*; kill: coaches still keep TeamSnap / sheets / docs after a season.
- Reach — *reported* (LTS greenfield, JRT is the owner's, COHSSA "an easy sell"); kill: COHSSA says no →
  JRT + LTS only.
- Alerts reach parents — *measured*: iOS web push only after Add to Home Screen; US SMS needs 10DLC.
- MAAPP — *measured*: every adult↔minor message copies a guardian or another adult.
- Build vs adopt — *reasoned*: Spond swaps TeamSnap for another app and leaves the rest scattered.
- **The bet**: a solo builder can hold ~100 minors' medical flags and emergency contacts securely.
  **Fallback**: contacts only; medical stays in Clubspot / paper cards. **Take it** if, before go-live,
  `security-audit` or the second reviewer finds an unresolved access-control gap on medical data, or
  consent is not confirmed.

## Recorded unknowns
| Unknown | Default in use | Risk | What settles it |
|---|---|---|---|
| Does HSC's Clubspot waiver cover sharing medical info with coaches through an app? | Assume yes | It does not → consent missing → the bet's fallback | Read the current waiver text; if not covered, add a versioned in-app consent screen |
| Who is the second security reviewer? | None named | Nobody by go-live minus two weeks → pilot runs contacts-only | Owner names a person |
| Will the Clubspot key arrive? | Build against the API | Key late → roster blocked | 2027-02-01 cutover to CSV import |
| Does the passkey-gated card cache work on iOS Safari and Android Chrome? | Assume yes | It does not → cards unprotected on device | Test on real devices at build; fallback is a printed card pack |
| TypeScript 7 tooling compatibility | Decide at scaffold | Tools lag the Go compiler | Scaffold checklist verifies; fall back to TS 6.x |
| A guardian under a legal contact restriction | Admin can unlink | Rare but serious | Unlink ships in v1 |
| Ohio breach-notification scope | Treat any medical exposure as notifiable | Legal detail unverified | Read ORC 1349.19 if an incident ever occurs |
| HSC's nonprofit status | Not relied on | None (COPPA kept out by design) | — |
| Whether Clubspot camps already take attendance | Not checked (page returned no content) | Low; it would not fix too-many-apps | Read the camps product docs |
| Video storage and consent to film minors | Deferred with video | — | Its own check when video is scheduled |
| LTS instructors under 18 on payroll | Deferred with coach pay | Ohio minor-labour hours limits | Its own check when coach pay is scheduled |

```yaml
charter_handoff:
  project: Coach's Dockbox
  repo: coachs-dockbox   # the owner's working name; the actual repo is named at the scaffold gate
  stack:
    language: TypeScript
    framework: React + Vite (PWA)
    data: Supabase Postgres (Pro, own organisation) with RLS and Edge Functions
    hosting: Cloudflare Workers static assets on an owner-registered domain
    ci: GitHub Actions; auto-deploy of the Worker and migrations on merge to release
  constraints:
    - "the medical-flags table is denied to every client role; only the medical Edge Function reads it"
    - "every emergency-card view writes a view-log row (who, which sailor, when)"
    - "no private coach-to-minor messaging; every message to a minor copies their guardians"
    - "sailors under 13 never sign in; the 13+ gate uses birth year"
    - "alerts go out by push AND email; never push alone"
    - "a tow slot can never be held by two volunteers (conditional write)"
    - "medical flags, emergency contacts and birth year are purged at the end of the sailor's last season"
    - "cached emergency cards cover today's event only, are encrypted, passkey-unlocked, and wiped after the event and on sign-out"
    - "roster import stores whitelisted fields only; medical, insurance and address columns from a Clubspot CSV are never stored"
    - "attendance taps respond instantly; the emergency card opens in under 1 s on mobile data"
    - "one tap marks a sailor here; the coach never picks a status: late comes from the start time, excused from the RSVP; a long-press overrides"
    - "attendance tiles keep a stable order and never move under the thumb while marking"
    - "every attendance action works one-thumbed with the other hand busy, in polarized sunglasses"
    - "at start time each still-missing sailor is one tap from calling or texting their guardian and one tap from their emergency card"
    - "nothing secret in the repo or the client bundle"
    - "every scheduled job is idempotent and catch-up-capable"
    - "schema changes only through versioned migrations"
    - "WCAG 2.2 AA with outdoor-glare contrast; cyan buttons carry dark ink"
    - "monthly running cost stays at or under 40 USD"
  non_goals:
    - "Payments and registration stay in Clubspot"
    - "Regatta scoring and results are Burgee's job"
    - "Dockbox never runs payroll; it exports approved hours and receipts"
    - "HSC only; no other clubs"
  external_criteria_candidates:
    - "Clubspot API key obtained — needs another HSC Clubspot admin and Clubspot support (CSV fallback from 2027-02-01)"
    - "HSC Clubspot waiver confirmed to cover sharing medical info with coaches via an app — needs the waiver text"
    - "Second technical reviewer has tried and failed to read a card they should not — needs a named person"
    - "security-audit passes on medical access — needs the built app"
    - "Passkey-gated card cache works on iOS Safari and Android Chrome — needs real devices"
    - "Restore rehearsal completed into a scratch project — needs the Supabase Pro organisation (owner billing)"
    - "Domain registered on the owner's Cloudflare — needs the owner's purchase"
    - "Signature moment timed at a real JRT practice (each arrival marked in under 3 s, one-thumbed, sunglasses on) — needs a real practice"
    - "At least 70% of JRT families reachable by week two — needs real families"
    - "Attendance taken in Dockbox at 70% or more of JRT practices — needs the real season"
    - "SMS 10DLC registration before LTS joins — needs HSC organisation details"
    - "COHSSA and LTS director sign-off — after the pilot"
    - "cohssa-attendance archived on GitHub — needs the owner's approval at its own gate"
  signature_moment: "As each sailor arrives, a coach marks them with one thumb in under 3 seconds without putting anything down; at start time the screen shows who is still missing, each one tap from their guardian's phone or emergency card."
  budget_ceiling_monthly: 40 USD
```

> **Frozen at ratification, 2026-09-29.** The working decision log from `forge-idea`, `charter-project` and `design-bar`, moved here from cairn's auto-memory inbox when this repo was scaffolded. `charter.md` and `adr/` are the documents of record; this is the question-by-question history behind them, kept for the rejected options.

slug: coaches-dockbox — charter-project decision log for **Coaches' Dockbox** (working name; first chosen as "Dock Box" 2026-09-28, renamed by the owner 2026-09-29)

In-flight working state for `charter-project`, not inbox material (`memory/auto/README.md` carve-out).
Deleted by charter-project once the charter lands in the target repo's `docs/`.

## Entry — forge-idea handoff (2026-09-28)

Verdict: **Hardened, with one bet.**

Idea, verbatim:

> "i have an idea to make this app much more compresive. It is going to be used as a coaching
> tool/resource. Coaches will be able to attach or create resources for the sailors. and upload videos
> of proactice. Coaches will be able to add lesson plans for the other coaches. and the sailors will be
> able to see them (if the coaches decide to do so). also, this is going to replace teamsnap. We will
> use it for attendance tracking. of sailors. COntact info emergency contact stuff. We will need to
> brainstom how to make it more streamlined than teamsnap. Also this will be used as a tracker for
> coaches hours. The coaches will be able to clock in and out and an admin will approve. this will be a
> one stop shop for saiing coaches and sailing instructors. At one point (not now) it will integrate
> with burgee app."

"This app" was `cohssa-attendance` — Vite + React PWA, pre-v1, Google Sheet as database, no backend,
bound by `policies/cohssa-minor-data-handling.md` (name / school / gradYear only). *Reasoned*: that
architecture cannot carry this idea; the attendance UI, `grades.js` and `dates.js` are salvage.
**Open**: evolve `cohssa-attendance` vs a new repo.

Owner answers at forge-idea (decisions unless tagged):

| Question | Answer |
|---|---|
| Audience | Hoover Sailing Club first — COHSSA, Hoover Junior Race Team (JRT), Hoover Learn to Sail (LTS) |
| Day-one TeamSnap jobs | Schedule + RSVP, messaging & alerts, contact directory. **Not** fees/payments |
| Minor data at the dock | Contacts **+ medical flags** |
| Coach hours | Payroll (paid hourly) **plus reimbursements** — travel, hotels |
| Pain with TeamSnap | Too many apps (*reported*) |
| Scale | Under 100 families, ~10 coaches (*reported*) |
| Who decides | Each program director. Owner directs JRT; LTS has no app today (greenfield); COHSSA director "an easy sell" (*reported*) |
| Builder | Owner alone, with Claude |

Surviving claims:

- **Problem** — *reported* by a program director. Kill: coaches still keep TeamSnap / sheets / docs
  after a season.
- **Reach** — *reported*. Kill: COHSSA says no → pilot JRT + LTS.
- **Alerts reach parents** — *measured* (search, 2026-09-28): iOS web push works only for PWAs added to
  the home screen, iOS 16.4+; US SMS needs A2P 10DLC registration, ~5 business days, $15 vetting fee,
  nonprofit path exists. Design rule (*reasoned*): push **and** email, SMS for weather; never push alone.
- **SafeSport MAAPP** — *measured* (U.S. Center for SafeSport electronic communications policy PDF,
  fetched 2026-09-28): every adult↔minor electronic communication must copy a parent/guardian or
  another adult, including minor-initiated; team comms must include another adult or all parents; only
  platforms that allow this may be used; a parent's request to stop must be honoured. → No private
  coach↔minor DMs; parents copied automatically.
- **Build vs adopt** — *reasoned*: Spond (*measured*: free, guardian accounts, messaging with parent
  oversight, multi-group clubs) swaps TeamSnap for another app and leaves hours, lesson plans, video and
  attendance elsewhere, so it does not fix "too many apps". Spond is the parity benchmark for the
  parent half. Connecteam (*measured*): free ≤10 users, $29/mo up to 30, time clock; reimbursements
  not on its pricing page.

**The bet**: a solo builder can hold ~100 minors' medical flags, emergency contacts and payroll records
securely. **Fallback**: launch with contacts only; medical stays in Clubspot / emergency cards. **Take
it** if, before the first program goes live, `security-audit` finds any unresolved access-control gap
on medical fields, or parental consent is not collected. Payroll holds hours + receipts only; tax and
bank data stay with the payroll processor.

Rejected at forge-idea: adopt Spond (+ Connecteam) — does not fix too-many-apps; a Burgee module —
Burgee unbuilt, owner chose HSC first; an any-program product — not now; contacts-only — owner chose
medical flags, kept as the fallback.

Unchecked, carried forward: video storage + consent to film minors; LTS instructors under 18 on
payroll (Ohio minor labour hours); under-13s must not sign in (COPPA); Clubspot import path; payroll
export format; whether Clubspot camps already take attendance (its camps page 404'd).

Experience vs mechanism (forge-idea Phase 2 read): the parent half is commodity **mechanism** (parity
with Spond / TeamSnap); the coach half — dock attendance with the emergency card, lesson plans,
practice video, clock-in — is the **experience** worth judging. `design-bar` candidate at the charter
gate.

## Phase 1 — Vision & success (2026-09-28)

Reused from forge-idea, not re-asked: problem (too many apps), who has it (coaches, parents and
sailors across three HSC programs), what they do today (TeamSnap + sheets + paper + scattered docs),
success scene (forge-idea announcement: "Hoover Sailing Club now runs Learn to Sail, the Junior Race
Team and COHSSA from one app …").

| # | Question | Options offered | Answer |
|---|---|---|---|
| 1.1 | Failure metric one season in | other apps still in use / families not reachable / attendance not in it (multi) | **All three, bar at 70%**: fail if other apps remain in use for ≥30% of the jobs Dock Box claims; <70% of families reachable by push or email by week two; attendance in-app at <70% of practices |
| 1.2 | First live season | COHSSA spring 2027 / JRT + LTS summer 2027 / JRT alone first | **JRT alone first**, then the others |
| 1.3 | Ambition — what must become true | dock-to-parent one tap / coaching knowledge stays / paid without paperwork / sailors see their growth (multi) | **All four** |
| 1.4 | Working name | Hoover-specific / neutral brand / keep cohssa-attendance → owner asked for suggestions + a conflict search → Dock Box / Telltale / Sailing Coaches Toolbox | **Dock Box** |

Notes:

- 1.1 — *reasoned*: 70% is the **failure line**, not the alert target. A weather cancellation still
  has to reach every family; the alert design is sized to 100%.
- 1.3 — *reasoned*: with all four chosen, the ambition is the **combination** in one app, which makes
  phase 3's non-goals load-bearing.
- 1.4 name search — *measured* (web search, 2026-09-28; no trademark check): "Coach's Toolbox" is sold
  by Tactical Sailing to sailing coaches; "Coachboat Pro" (Fastrrr) and coachboat.com take Coach Boat;
  Pennant Yachts is in the sailing space; "Chaseboat" is an unrelated mobile game; **no software found
  for "Dock Box" or "Telltale"**.
- Field, *measured* (fetched 2026-09-28): **SailCoach** (sailcoach.app) — sailing "coaching
  continuity" platform, early access / beta: session debriefs, shared multi-coach sailor records,
  results pulled from events; the page names no attendance, lesson plans, video, messaging, schedule
  or payroll. **SportEasy** — generic team app pitched at sailing groups: calendar, messaging,
  documents, attendance, member data. Neither covers operations + coaching + hours. SailCoach is
  two-directional evidence: coaching continuity is a live idea others are building (argues the
  ambition is real), and it is beta (argues nobody owns it yet).

Phase 1 exit: problem, success scene, failure metric, ambition — done. Owner chose **continue**.

## Phase 2 — Users & access (2026-09-28)

Skipped, with reason: **scale** — forge-idea's *reported* <100 families / ~10 coaches is the year-1
number; sizing target ~10× (≈1,000 families, ≈100 coaches) per the size-to-measured-load rule.
**Internationalization** — English-only until revisited (default, unprompted). **Accessibility** —
WCAG 2.2 AA plus outdoor-glare contrast, the house default; inherits cohssa-attendance's rule that cyan
buttons carry dark ink, not white (white on `#00AEEF` ≈ 2.6:1).

Design rules, *reasoned*, not asked: a sailor may belong to more than one program and a coach may
coach several (membership is per program); each parent/guardian has their **own** login and a sailor
links to any number of guardians, so split households both see their child. **Recorded unknown**: a
guardian with a legal restriction on contact — default: an admin can unlink a guardian; risk: rare, but
the failure is serious, so the unlink must exist in v1.

User types (derived from phases 1–2): coach, program director, treasurer, parent/guardian, sailor 13+.

| # | Question | Options offered | Answer |
|---|---|---|---|
| 2.1 | Sailor logins | 13+ only, parent-linked / parents only / all sailors any age | **13+ only, parent-linked**. Under-13s never sign in; parents see for them. Keeps COPPA out by construction. Requires **birth year** (not only grad year) |
| 2.2 | Sign-in | email link + Google / Google only / email + password / phone + SMS code | **Email magic link + Google**. No passwords; recovery = the email link itself |
| 2.3 | Who sees medical flags | their program's coaches / any HSC coach / only coaches on duty | **Coaches and director of the sailor's program(s), plus the sailor's own guardians**. Other programs' coaches cannot |
| 2.4 | Hours & reimbursement approval | director approves + treasurer exports / director does all / one club admin | **Program director approves their coaches; a treasurer role sees approved totals and exports, with no sailor data** |

Consequences, *reasoned*: 2.1 means the data model needs a birth year and an age gate on sailor
sign-in; 2.2 makes transactional email a dependency (deliverability matters to sign-in *and* alerts);
2.3 is enforceable only if access control lives in the data layer, not only in the UI — the
`cohssa-minor-data-handling` lesson (the control that holds is structural). Phase 4 and phase 7 pick
these up.

Phase 2 exit: user types enumerated, auth model chosen, scale on the log.

## Phase 3 — Functional scope (2026-09-28)

Workflows proposed as behaviours (numbering used below):

- **Dock core** — (1) a coach marks attendance on the dock in under a minute (P / L / E), sees who is
  missing, and reaches a missing sailor's parent in one tap; (2) a coach opens a sailor's emergency
  card (contacts + medical flags) in one tap from attendance; (3) parents and sailors see the schedule
  and RSVP, so coaches know who is coming; (4) a director sends a weather cancellation that reaches
  every family by push + email, and SMS when urgent; (5) team messages copy parents automatically —
  no private coach↔minor chat (**MAAPP; a standing constraint, not an owner choice**); (6) parents keep
  their child's contacts, birth year and medical flags current themselves, consent recorded.
- **Coach pay** — (7) clock in / out at the dock, director approves the week; (8) receipt photo →
  director approves → treasurer exports approved hours + reimbursements per pay period.
- **Coaching library** — (9) a coach writes or attaches a lesson plan or resource, shares it with
  coaches, and per item chooses whether sailors see it.
- **Video & growth** — (10) practice video tagged to sailors, watchable by tagged 13+ sailors and
  their parents; (11) a 13+ sailor sees their own attendance, lessons and video over time.
- **Setup** — (12) a director brings in the roster and assigns sailors and coaches to programs.
- **Added by the owner** — (13) **towing schedule**: JRT needs two boats (trailers) towed to regattas;
  parent volunteers sign up, and the director tracks who is towing what, and when.

| # | Question | Options offered | Answer |
|---|---|---|---|
| 3.1 | Groups in the JRT pilot | dock core / coach pay / coaching library / video & growth (multi) | **Dock core (1–6) + coaching library (9) + towing schedule (13, owner-added)**. Coach pay (7–8) and video & growth (10–11) **later** |
| 3.2 | Non-goals (≥3) | payments & registration / regatta scoring & results / running payroll / other clubs (multi) | **All four**: payments & registration stay in Clubspot; regatta scoring & results are Burgee's; Dock Box never runs payroll (exports only); HSC only, no other clubs |
| 3.3 | Roster source | Clubspot CSV import / hand entry / Clubspot API now | **Clubspot API now** |
| 3.4 | HSC payroll today | QuickBooks / payroll service / spreadsheet / don't know | **Payroll service (Gusto / ADP-style)** — *reported*; export targets that service's hours import. Applies when coach pay ships |

Standing non-goal, not owner-optional: **no private coach↔minor messaging** (MAAPP, *measured*).

Consequences, *reasoned*: the pilot tests failure metrics 2 (families reachable) and 3 (attendance
in-app) and part of 1; the **"paid without paperwork" and "sailors see their growth" ambitions are not
tested by the pilot**. Workflow 12 in the pilot means the Clubspot integration is on the pilot's
critical path.

Clubspot API — *measured* (api.theclubspot.com, fetched 2026-09-28): keys **by request** to
support@theclubspot.com, **scoped to clubs you manage**, and "do not … expose them on the client"
(server-side only). `GET /api/:version/camp-registrations` — **read-only**. Participant fields: first /
last name, email, mobile, primary + secondary parent/guardian name / email / mobile. **No** emergency
contacts, medical or birthdate. **No** rate limits documented; **no** webhooks → scheduled polling.
Consequences, *reasoned*: parents supply birth year (the 13+ gate), emergency contacts and medical flags
in workflow 6; the API is privacy-favourable because it cannot carry the sensitive columns. **Fallback:
CSV import** of the Clubspot export — which *does* carry medical / insurance / address columns
(cohssa-attendance `CLAUDE.md`), so the importer must whitelist columns and discard the rest before
anything is stored.

| # | Question | Options offered | Answer |
|---|---|---|---|
| 3.5 | Who can get the Clubspot key | I'm an HSC Clubspot admin / another HSC admin must / don't know | **Another HSC admin must request it** — *reported*. The pilot's roster waits on a third party → externally gated |
| 3.6 | Towing schedule tracks | regatta + trailer + boats / tow out vs back / vehicle can tow it / insurance-waiver (multi) | **Regatta + trailer + boats; tow-out and tow-back as separate slots, each dated and timed; the volunteer's vehicle and hitch (ball size, towing capacity) matched to the trailer**. No insurance / waiver tracking |
| 3.7 | JRT pilot live by | spring 2027 (Apr–May) / summer 2027 (Jun) / sooner (this fall/winter) | **Spring 2027, April–May** — ~6–7 months from 2026-09-28 |

`external_criteria_candidates` (for the phase 9 handoff — none can be discharged inside a working
session):

- Clubspot API key obtained by another HSC admin from support@theclubspot.com.
- A2P 10DLC SMS registration for HSC (~5 business days, $15 vetting, nonprofit path) — only if SMS is
  in the pilot's alert path.
- Parental consent for medical flags collected from every JRT family before go-live.
- ≥70% of JRT families reachable (push or email verified) by week two of the pilot.
- `security-audit` pass on medical-field access before go-live — **the bet's trigger**.
- An email-sending domain whose DNS someone can edit (magic links + alerts) — owner to confirm in
  phase 6 / 8.
- COHSSA and LTS director sign-off — after the pilot, not before it.

| # | Question | Options offered | Answer |
|---|---|---|---|
| 3.8 | Clubspot fallback | CSV if no key by Feb 1 / build CSV first anyway / wait for the key | **Build against the API; if no key by 2027-02-01, switch to CSV import** (whitelisting importer) |

Integrations and failure modes, *reasoned* from the answers: **Clubspot API** — key never arrives
(→ 3.8 fallback); polling job fails silently, leaving a stale roster (needs a visible "last synced"
time). **Transactional email** — magic links and alerts land in spam (sign-in and alerts both fail).
**Web push** — family never adds the app to the home screen (iOS gets no push; email covers).
**SMS** — 10DLC not registered (no urgent channel). **Google Sign-In** — an optional path only.
**Payroll service** — later, with coach pay.

Phase 3 exit: workflows listed, integrations with failure modes, 4 non-goals + the MAAPP constraint,
external criteria recorded. Owner chose **continue**.

## Phase 4 — Data (2026-09-28)

**Compliance flag raised at phase entry** (minors' data + health data present). House precedent
`policies/cohssa-minor-data-handling.md`: its *rule* is cohssa's and does not generalise; its *shape*
does — the control that holds is **structural** (what the app can reach), not code review. Regulatory
consequences go to phase 7.

Entities (nouns), *reasoned* from phases 1–3: club; program; season; person; membership (person ×
program × season × role: coach / director / treasurer / sailor); guardian link (guardian ↔ sailor,
many-to-many, admin-unlinkable); sailor profile (birth year, grad year, `clubspot_id`); contacts;
emergency contacts; **medical flags**; consent record; event (practice / regatta / other); RSVP;
attendance mark (P / L / E, blank = absent); alert + per-recipient delivery status; message (parents
auto-copied); lesson plan / resource (visibility: coaches / + sailors); trailer; boat; volunteer
vehicle (hitch ball size, towing capacity); tow slot (event × trailer × direction out|back × date-time
× volunteer); Clubspot sync record. Later releases: time entry, reimbursement + receipt image, video +
sailor tags.

Consistency, *reasoned*: **tow-slot sign-up is wrong-answer-wrong** — two parents claiming one slot
must be impossible, so it is a conditional write against current state. Attendance keeps
cohssa-attendance's one-taker-per-practice rule. RSVP, schedule and library tolerate seconds of
staleness.

Volume, *reasoned*: ~100 sailors, ~150 guardians, ~10 coaches; ~200 events and ~20k attendance marks
a year; lesson plans in the hundreds. Small in every dimension except the later video feature.

| # | Question | Options offered | Answer |
|---|---|---|---|
| 4.1 | Medical flag content | checklist + action note / checklist only / free text | **Fixed checklist** (severe allergy, carries EpiPen, asthma inhaler, seizures, weak swimmer, other) **+ one short "what to do" note**. No free-form diagnoses or medication lists |
| 4.2 | Walling off medical | separate + DB-enforced + logged / that plus field encryption / keep medical out (fallback) | **Separate table, access enforced in the database by program membership, every emergency-card view logged (who / which sailor / when), plus field-level encryption with a server-held key** |
| 4.3 | Retention when a sailor leaves | purge sensitive, keep history / delete on parent request / keep everything | **Medical flags, emergency contacts and birth year purged at the end of the sailor's last season; attendance and lesson history kept** |
| 4.4 | Lesson plan ownership | club keeps / coach owns / coach owns + club copy | **The club keeps them** when a coach leaves; coaches told so at authoring |

Ownership, *reasoned* from 4.3–4.4: **family-owned** — contacts, emergency contacts, medical flags,
birth year (guardians edit; purged per 4.3); **club-owned** — attendance, events, RSVPs, lesson plans,
towing records. The consent record carries no medical content and is **retained after the purge** as
proof consent was given.

Notes, *reasoned*: 4.2's encryption defends a **stolen database or backup**; it does not defend a
compromised server or a signed-in coach's session — the DB-enforced access and the view log cover
those. The key's home and rotation are a **solo-operator** problem → phase 6 (platform secret store)
and phase 7. The 4.3 purge is itself a job that can silently not run → it needs a test and a visible
last-run record.

Phase 4 exit: entities, ownership, retention, sensitivity classification, volume — done. Owner chose
**continue**.

## Phase 5 — Non-functional (2026-09-28)

Recorded unprompted, *reasoned*: **load pattern — spiky on a known calendar** (practice evenings,
regatta weekends, alert bursts). **Design load** — phase 2's year-1 × ~10: ~1,000 families, ~100
coaches; one alert ≈ 2,500 recipient-deliveries across push / email / SMS. **Attendance at Hoover —
online-first** (cohssa-attendance *reported* the site's connectivity as reliable); a failed save is held
on the device and retried, not a full offline sync layer. Default risk: an away regatta with no signal
cannot record attendance until signal returns.

| # | Question | Options offered | Answer |
|---|---|---|---|
| 5.1 | Emergency card with no signal | cache today's cards / printed card pack / online only | **Cache today's cards**: the coach's device holds encrypted cards for sailors at today's event and wipes them afterwards; a device passcode is required |
| 5.2 | Outage during a storm cancellation | send from the provider / printed phone tree / accept the risk | **Guardian contacts sync to the email / SMS provider; a director can send from the provider's own dashboard.** One-page runbook |
| 5.3 | Observability | errors alert the owner / weekly health email / find out in use | **Failures alert the owner immediately** — failed alert deliveries, stale Clubspot sync, purge job not run, server errors — via a free-tier error tracker |
| 5.4 | Latency | instant taps + card <1s / under 2s is fine | **Attendance taps optimistic (instant feedback, background save); emergency card opens in <1 s on mobile data** |

Consequences, *reasoned*, carried forward:

- 5.1 puts decrypted medical data on a device for hours — it **reopens part of 4.2** (field encryption
  covers the server, not the phone). Needs: per-event scope, wipe after the event (and on sign-out), an
  offline-capable encrypted local store, and a device-passcode requirement the app cannot fully
  enforce in a browser → **phase 6** (PWA vs native wrap) and **phase 7**.
- 5.2 sends guardian contacts (never medical) to a third-party processor → phase 7's processor list.
- 5.3's error tracker must **scrub PII and medical fields** before anything leaves the server — an
  error report is a data flow → phase 7.

Phase 5 exit: numbers and shapes on the log. Owner chose **continue**.

### Name change (2026-09-29)

**Renamed by the owner: "Dock Box" → "Coaches' Dockbox"** (slug `coaches-dockbox`; this log renamed to
match). **Correction to 1.4**: the 2026-09-28 search for "Dock Box" (two words) found no software, but
*measured* 2026-09-29, **"Dockbox" (one word) is a live software product** — Dockbox by AiOn Systems
(dockbox.dev), a team collaboration suite with chat, projects, files, calendar. Same broad category.
"Coaches' Dockbox" is more distinct than the bare word; no trademark check performed. Kept at the
owner's choice.

## Phase 6 — Stack & architecture (2026-09-29)

Owner's prior stacks, *measured* from cairn memory (not asked): **Supabase** (Taskr, tender,
pro-companion — deep RLS, auth, edge-function notes), **Vercel** (Taskr, tender), **Resend** via a
Cloudflare-managed domain (Taskr #191), **Cloudflare Pages + D1** (madcowsailing), **React + Vite**
(cohssa-attendance, Taskr). *Reported* 2026-09-23: the owner's Free Supabase organisation already
holds **two active projects (Taskr, tender) — the Free limit**.

| # | Question | Options offered | Answer |
|---|---|---|---|
| 6.1 | Monthly budget ceiling | $40 / $15 / $100 / $0 | **Up to $40/month** |
| 6.2 | Who pays | owner personally / HSC from the start / owner now, HSC after pilot | **Owner during the pilot; HSC takes over billing after it proves out** → every service account goes in its **own organisation** so it transfers cleanly |

Research, *measured* (vendor pages fetched 2026-09-29):

- **Supabase** — Pro "from $25/month", $10 compute credits = one Micro; daily backups kept 7 days; paid
  projects "not paused for inactivity"; spend cap on by default; 8 GB disk, 250 GB egress, 100k MAU,
  2M edge-function invocations. Free: paused after 1 week, no backups, 2 active projects.
  **Vault** is for secrets (`vault.secrets`), not arbitrary column encryption; the key is held outside
  the database by Supabase. **pgsodium / Transparent Column Encryption: "does not recommend … as it
  will be deprecated"; TCE not recommended "due to their high level of operational complexity and
  misconfiguration risk"**; Supabase says default encryption at rest "likely is sufficient for your
  compliance needs e.g. SOC2 & HIPAA". → **tension with 4.2**, put to the owner at the data-layer
  decision rather than resolved here.
- **Resend** — Free transactional: **100 emails/day**, 3,000/month, 3 domains; Pro $20/month for
  50k. **Marketing broadcasts, free: unlimited sends to ≤1,000 contacts/month, no daily cap**; Pro
  marketing $40/month for 5,000 contacts. 10 requests/second on all plans. No nonprofit discount.
- **Amazon SES** — $0.10 per 1,000 emails à la carte, no minimum; $200 credits for 6 months for new
  accounts. No dashboard compose (so no 5.2 outage path on its own). *Reasoned*: new SES accounts
  start in a sandbox and need an AWS production-access request — an external gate.
- **Twilio SMS** — $0.0083 per segment + carrier pass-through $0.0025–$0.0062; long-code number
  $1.15/month. 10DLC fees: the Twilio help page did not render; secondary sources (search, not
  primary): sole-proprietor brand $4 one-time, $15 campaign vetting, first brand + campaign bundled
  $22.50–$64, campaign fee renewing monthly. *Treat the 10DLC figures as reported, not measured.*
- **Vercel** — Hobby "is for personal, non-commercial use" → **not eligible for an HSC app**; Pro
  $20/month per developer seat.
- **Cloudflare Workers** — Free: 100,000 requests/day; **static-asset requests free and unlimited**;
  Paid from $5/month. No commercial-use restriction found on the page.
- **Sentry** — Developer (free): 1 user, 5k errors/month, 30-day lookback, email alerts. Team $26/month.
- **Firebase** — Firestore free: 1 GiB, 50k reads / 20k writes / 20k deletes per day (same no-cost
  quota on Blaze); Auth free to 50k MAU incl. email link; **FCM free**. The pricing page summary read
  Functions as available on Spark, which **contradicts** the Functions docs as measured 2026-09-23
  ("must be on the Blaze pricing plan", `supabase-org-billing-and-firebase-as-alternative`) — unresolved,
  weight the docs. Blaze has no spend cap on Firestore / Storage (same note).

Budget arithmetic, *reasoned*: Supabase Pro $25 leaves **$15**. Resend Pro ($20) would breach the
ceiling; **alerts as Resend broadcasts (free ≤1,000 contacts) + magic links as transactional (100/day)**
fits year-1 (<100 families ≈ 200 guardian contacts). Ceiling: 1,000 contacts / 100 transactional per
day → move: Resend Pro, or SES for the transactional half.

| # | Question | Options offered | Answer → ADR |
|---|---|---|---|
| 6.3 | Backend | Supabase Pro in a new org / Firebase Blaze / Cloudflare Workers + D1 | **Supabase Pro in a new organisation** ($25/mo; Postgres + RLS, Auth email link + Google, Storage, Edge Functions, pg_cron) → ADR 001 |
| 6.4 | Medical-flag encryption, given Supabase's advice | encrypt in one server function / at-rest only + DB rules + log | **App-level encryption inside one Edge Function**: RLS denies the medical table to every client role; the function checks program membership, writes the view-log row, decrypts, returns. Key in Edge Function secrets. **Supersedes the mechanism of 4.2, not its intent** → ADR 002 |
| 6.5 | Web hosting | Cloudflare Workers static assets / Cloudflare Pages / Vercel Pro | **Cloudflare Workers (static assets)** → ADR 003 |
| 6.6 | Email | Resend split sends / Amazon SES / Resend Pro | **Resend, split**: magic links transactional (Supabase custom SMTP), alerts as per-program broadcasts → ADR 004 |

Rejected, with reason: **Firebase** — no spend cap on Firestore / Storage, card required, new to the
owner; its free FCM push is the real loss. **Cloudflare D1** — no database-enforced access, so 4.2's
"enforced in the database" would live in Worker code; build-your-own auth. **At-rest-only** — a stolen
backup or leaked service key exposes the flags. **Cloudflare Pages** — "legacy" per the 2026-09-27
note. **Vercel** — Hobby is non-commercial; Pro breaks the ceiling. **SES** — sandbox gate, no compose
dashboard for 5.2. **Resend Pro** — breaks the ceiling.

Ceilings and moves, *reasoned*: Supabase Micro at a design load of ~1,000 families is far under
capacity → move: Small compute when p95 query latency breaks the 5.4 budget. Resend free at 1,000
contacts / 100 transactional per day → move: Resend Pro ($20) with HSC paying. Cloudflare Workers free
at 100k dynamic requests/day — the app is static assets + Supabase calls, so the Worker count stays
near zero → move: Workers Paid $5.

Design consequence of 6.4, *reasoned*: one function is the **only** path to medical data, so the
view log (4.2) and the device-cache feed (5.1) both come from it for free, and a client-side bug cannot
reach the table. Risk: the function is the single point every emergency card depends on → it needs a
test proving a coach of another program is refused, and the owner-alert of 5.3.

Research, *measured* 2026-09-29: **npm registry** — vite 8.3.1 (latest; `previous` 7.3.6), react 19.3.0,
**typescript 7.0.2** (the Go-native compiler major — tooling compatibility to be checked at scaffold,
not assumed), @capacitor/core 8.5.2, @supabase/supabase-js 2.117.2, vite-plugin-pwa 1.3.0, wrangler
4.143.0, vitest 5.0.2. **Capacitor** (Context7, capacitorjs.com docs) — 8.x documented; Android push via
the official plugin depends on Firebase Messaging; iOS via APNs. **Apple Developer Program** — $99 /
membership year; nonprofit fee waiver available on request; **organisation** enrolment needs a D-U-N-S
number, a legal entity (no DBAs), binding authority, an org-domain email and a public website.
Versions go stale again before the scaffold; the scaffold checklist re-fetches them.

| # | Question | Options offered | Answer → ADR |
|---|---|---|---|
| 6.7 | App shape | web app for the pilot / web for families + native for coaches / store apps for everyone | **Web app (PWA) for the pilot**; a native coach app is the named move if the pilot shows the need → ADR 005 |
| 6.8 | Push | standard web push from a Supabase function / Firebase Cloud Messaging / OneSignal | **Standard Web Push (VAPID) sent from a Supabase Edge Function**; no third party holds device tokens → ADR 006 |
| 6.9 | SMS in the pilot | push + email only / texts for weather from day one | **Push + email only in the pilot**; SMS (Twilio, 10DLC) before LTS joins in summer → ADR 006 |
| 6.10 | Front end | React + TS + Vite / Next.js / SvelteKit | **React + TypeScript + Vite PWA**, salvaging cohssa-attendance's attendance screen, `grades.js`, `dates.js` → ADR 007 |

Rejected: **coach native app now** — $99/yr + $25, and iOS builds need a Mac or a paid cloud Mac
(the owner is on Windows); held as the move. **Store apps for everyone** — App Store review and HSC
D-U-N-S enrolment on the pilot's critical path. **FCM** — adds a Google project for no pilot gain.
**OneSignal** — third party holds the device list. **SMS day one** — registration gate + $5–10/mo for a
pilot of one small team. **Next.js** — OpenNext adapter on Workers, SSR buys nothing behind sign-in.
**SvelteKit** — new to the owner, no salvage.

**6.7 reopens part of 5.1**, *reasoned*: a browser cannot verify a device passcode. Mitigation for the
ADR: cached cards are encrypted with a non-extractable WebCrypto key and unlocked only by a **passkey
(WebAuthn) with `userVerification: "required"`** — a platform authenticator exists only on a device with
a screen lock, so the requirement is enforced indirectly. **To verify at build, not assumed.** The
cache is wiped after the event and on sign-out. Risk if the passkey route fails: the fallback is
5.1's "printed card pack" option.

**6.7 and the reachability metric**, *reasoned*: iPhone families get push only after "Add to Home
Screen"; email carries everyone else, so the onboarding flow must ask for the install and verify a
test push. That is failure metric 1.1's "families reachable" number.

| # | Question | Options offered | Answer → ADR |
|---|---|---|---|
| 6.11 | Repo | new repo `coaches-dockbox` / evolve cohssa-attendance | **New repo `coaches-dockbox`**; salvage copied in → ADR 008 |
| 6.12 | cohssa-attendance meanwhile | freeze, COHSSA joins later / finish v1 as a bridge / archive | **Archive it.** COHSSA runs spring 2027 on paper and joins Dockbox after the pilot. Archiving is a GitHub write → **its own gate at the writes stage**, never done inside discovery. `policies/cohssa-minor-data-handling.md` then needs its status moved to superseded / archived in the same pass |
| 6.13 | First real test | medical access refused / grade-date unit tests | **A coach of another program is refused a sailor's emergency card**, run against a local Supabase in CI — proven failable per `prove-tests` → ADR 009 |
| 6.14 | Monitoring | Sentry free + scheduled health check / health check only | **Sentry Developer (free) for exceptions, with PII / medical scrubbing before send, plus a scheduled health-check function that emails the owner on failed deliveries, stale Clubspot sync, or a purge that did not run** → ADR 010 |

Recorded unprompted — the workspace standing default, owner directive 2026-09-01, applies unless the
owner decides otherwise: **branch model** `develop` (integration, default) / `release` (production,
entered by PR from `develop`) / `main` (backup, entered by PR from `release`), with `githooks/pre-push`
refusing direct pushes to all three → ADR 008. **CI**: GitHub Actions running lint, type-check, unit
tests and the 6.13 test on every PR. Known trap for 6.13: `supabase start` pulls from `ghcr.io` were
throttled 2026-09-23; `SUPABASE_INTERNAL_IMAGE_REGISTRY: public.ecr.aws` fixed it
(`ghcr-throttle-is-not-lifted-by-docker-login-2026-09-23`).

**Day-1 seams**, decided for this stack (→ ADR 011):

- Schema changes as versioned `supabase/migrations/` in the repo; never hand-applied to production.
- One data module per store (`db/` for Supabase tables, `medical/` as the sole caller of the medical
  Edge Function) so the query layer can change without a sweep.
- Config and secrets from the environment through one typed loader that fails at boot on a missing
  value — client (`VITE_` public values only) and Edge Functions separately.
- Scheduled work named: **pg_cron → Edge Functions** for the Clubspot poll, the 4.3 purge and the 6.14
  health check; each idempotent and catch-up-capable (house rule from the free-tier note, kept on Pro).
- Vite's **current** recommended layout, re-fetched at scaffold.
- Strict type-checking and a linter from the first commit (TypeScript 7 compatibility checked then).

**Sizing**, *reasoned*: nothing here adds a queue, a cache or a second deployable. At ~1,000 families
the single Supabase Micro + static hosting carries the load with room to spare.

Phase 6 exit: every decision owner-picked; ADRs 001–011 to be drafted at phase 9. No deferred stack
decision. Owner chose **continue**.

## Phase 7 — Security & compliance (2026-09-29)

**Threat sketch**, *reasoned*: nobody targets a club app. Defend against opportunistic scanners; a
leaked Supabase service-role key; takeover of a parent's email account (the magic link lands there); a
former coach whose access never ended; an insider coach browsing another program's medical flags; a
lost phone holding cached cards; a guardian under a legal contact restriction. Mapped controls: RLS +
the single medical function (6.4), passkey-gated card cache wiped after events (6.7), season-scoped
memberships (7.3), guardian unlink (phase 2), view log with a reader (7.2).

**Secrets rule**: nothing secret in the repo or the client bundle; the client holds only the public
anon key and URL (`VITE_`), and the service-role key and the medical encryption key live only in Edge
Function secrets. `.gitignore` covers `.env*`; the README says where secrets live instead.

**Dependency policy**, recorded unprompted from the owner's practice (tender uses Dependabot): **Dependabot**,
weekly, with `groups:` for lockstep peer packages — two entries, since `applies-to` is version-updates
*or* security-updates (`dependabot-splits-lockstep-peer-packages-2026-09-19`). The owner reviews and
merges; nothing auto-merges.

**Regulation**, *measured* where tagged:

- **COPPA** — *measured* (FTC COPPA FAQ, fetched 2026-09-29): "COPPA only applies to personal
  information collected online **from** children"; information about a child collected from a parent is
  outside it; a 13+-only service is outside it unless "directed to children" by the Rule's factors; and
  COPPA "applies to commercial websites … not to nonprofit entities" (except those operating for
  commercial members' profit). → kept out **by construction** (2.1): under-13s never sign in, parents
  enter their data. HSC's nonprofit status is **unverified** and not relied on.
- **SafeSport MAAPP** — *measured* at forge-idea; enforced by design (parents auto-copied, no private
  coach↔minor messaging, honour a parent's stop request).
- **HIPAA** — *reasoned*: HSC is not a covered entity (not a provider, plan or clearinghouse); does not
  apply. Supabase's HIPAA add-on not needed.
- **Ohio breach notification** — *reasoned*, unverified: Ohio's statutory "personal information" is
  built around SSNs, licence and account numbers, none of which Dockbox stores. Recorded unknown;
  default: treat any medical-data exposure as notifiable to families regardless.
- **Coach pay (later release)** — Ohio minor labour hours and FLSA timekeeping records. Deferred with
  coach pay; recorded so it is not forgotten.

| # | Question | Options offered | Answer |
|---|---|---|---|
| 7.1 | Parental consent for medical flags | in-app versioned / Clubspot waiver covers it / paper form uploaded | **HSC's Clubspot registration waiver covers it** — *reported* belief, **unverified** |
| 7.2 | Who reads the view log | monthly digest to directors / only on incident / parents can see views | **Monthly digest to each director**: who opened which of their sailors' cards, flagging views on non-event days |
| 7.3 | Coach offboarding | director removes + season end / season end only | **Director removes in one tap (wipes cached cards at next sync) and all access also lapses at season end** |
| 7.4 | Pre-launch security check | security-audit + a second person / security-audit only | **cairn `security-audit` plus a second, technical person** who reads the RLS and tries to see a card they should not |

Consequences, *reasoned*:

- **7.1 is load-bearing and unchecked.** The bet's fallback trigger is "parental consent not
  collected". The waiver's wording must be **read** and must cover sharing medical information with
  coaches **through an app**, not only on paper. → `external_criteria_candidates`: read the current
  HSC Clubspot waiver text. **Default if it does not cover it**: add a one-screen in-app consent at the
  moment a parent enters flags (the option 7.1 did not pick), versioned and retained after purge.
- **7.4 adds a person to the critical path** → `external_criteria_candidates`: a named second
  reviewer before go-live. Default if none is found by go-live minus two weeks: the bet's fallback
  (contacts only) for the pilot.

Phase 7 exit: threat sketch written, secrets rule stated, regulation flags resolved or recorded-unknown.
Owner chose **continue**.

## Phase 8 — Cost & operations (2026-09-29)

Budget ceiling confirmed: **$40/month** (6.1), owner-paid through the pilot (6.2).

Cliff re-check, *measured* 2026-09-29 (supabase.com/docs/guides/auth/rate-limits): Supabase's **built-in
auth mailer sends 2 emails/hour** and is not configurable → **custom SMTP (Resend) is mandatory**, not
optional; with custom SMTP the email rate limit is configurable. Magic link / OTP: 60 s per user
between requests; `/auth/v1/verify` 30 requests per 5 minutes per IP (configurable). **The binding cap
is then Resend's 100 transactional emails/day** (6.6). JRT (~30 families) fits; **onboarding all three
programs must be staggered across days**, or Resend Pro once HSC pays. No phase-6 ADR is contradicted.

Domain availability, *measured* by RDAP 2026-09-29: coachsdockbox.com, coachsdockbox.org,
coachesdockbox.com — 404 (not registered) at their registries; dockbox.club — 404 via rdap.org
(less certain).

| # | Question | Options offered | Answer |
|---|---|---|---|
| 8.1 | Domain | new domain on the owner's Cloudflare / subdomain of HSC's site / free workers.dev | **A new domain on the owner's Cloudflare account** (e.g. coachsdockbox.com, ~$10–12/yr at cost); transfers to HSC's Cloudflare after the pilot. **Exact name chosen at registration** — sticky, since passkeys (WebAuthn RP ID) and Resend sending are bound to it |
| 8.2 | Deploys | auto-deploy on merge to `release` / manual from the owner's PC | **CI deploys the Worker and applies migrations on merge to `release`** — what runs always matches the branch (`supabase-edge-function-deploy-state-2026-08-27`: a deploy is otherwise the one production act with no artefact in the repo) |
| 8.3 | Restore rehearsal | one before the pilot / trust backups | **One restore rehearsal into a scratch project before go-live**, steps written into the runbook |
| 8.4 | Response expectation | best effort same day / watch practice hours | **Best effort, same day.** The 5.2 provider-dashboard path covers alerts during an outage |

Monthly cost at pilot, *reasoned* from the measured prices: Supabase Pro $25 + domain ~$1 + Cloudflare
Workers $0 + Resend $0 + Sentry $0 + web push $0 ≈ **$26/month**, $14 under the ceiling. Priced
moves: SMS before LTS joins ≈ +$5–10; Resend Pro $20 when onboarding outgrows 100/day (HSC paying);
a native coach app +$99/yr Apple (nonprofit waiver possible) + $25 once Google.

**Operator**: the owner — deploys are automatic (8.2), migrations ride the deploy, restores are
rehearsed once (8.3). **On-call**: none; alerts reach the owner (5.3); response best-effort same day.
**Handover to HSC after the pilot**: transfer the Supabase organisation, the Cloudflare domain and
Workers, the Resend team and the Sentry project — every one was created in its own organisation (6.2)
so each transfers whole.

Phase 8 exit: budget ceiling confirmed, cliffs named with numbers and dates, operator named.

Owner chose **continue**.

## Phase 9 — Charter assembly (2026-09-29) — RATIFIED at the charter gate 2026-09-29

Everything below is compiled from phases 1–8 above; nothing new is decided here except the drafted
**signature moment**, which the owner confirms or amends at the gate. Lands as `docs/charter.md` and
`docs/adr/NNN-*.md` in `coaches-dockbox` at the scaffold step, after which this log is deleted.

---

# Coaches' Dockbox — charter

## Metadata
- Status: ratified 2026-09-29
- Owner: HSCCo (Hoover Sailing Club; JRT program director)
- Forge-idea provenance: run 2026-09-28, verdict *hardened, with one bet*
- Decision log: `charter-coaches-dockbox-decision-log.md` (cairn auto-memory; deleted once this lands)

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
| Repo, branches, CI/CD | New repo `coaches-dockbox`; develop / release / main; auto-deploy on `release` | adr/008-repo-branches-deploy |
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
  project: Coaches' Dockbox
  repo: coaches-dockbox   # the owner's working name; the actual repo is named at the scaffold gate
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

---

# ADRs (draft, 2026-09-29) — each lands as docs/adr/NNN-<slug>.md

## ADR 001 — Supabase Pro in its own organisation is the backend
- Status: proposed 2026-09-29 · Phase 6
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

## ADR 002 — Medical flags are reachable only through one Edge Function, encrypted in the app — THE BET
- Status: proposed 2026-09-29 · Phases 4, 6
- **Context**: the owner chose field encryption + DB-enforced access + a view log (4.2). Supabase "does
  not recommend" pgsodium / TCE ("high level of operational complexity and misconfiguration risk") and
  says at-rest encryption "likely is sufficient"; Vault is for secrets, not columns (*measured* 2026-09-29).
- **Options**: **one Edge Function** (RLS denies the table to all client roles; the function checks
  membership, logs, decrypts); **at-rest only + RLS + log** (simpler; a stolen backup or leaked
  service-role key exposes the flags); **keep medical out** (the fallback).
- **Decision**: one Edge Function, app-level encryption, key in Edge Function secrets.
- **Consequences**: the view log and the device-cache feed come from the same function; a client bug
  cannot reach the table; the function is the single dependency of every emergency card.
- **Ceiling and next move**: not load-bound at this scale. Key rotation is manual for a solo operator →
  written into the runbook.
- **Kill condition — the bet**: `security-audit` or the second reviewer finds an unresolved access gap
  on medical data before go-live, or consent is not confirmed. **Fallback**: ship the pilot with
  contacts only; medical stays in Clubspot / paper cards.

## ADR 003 — Cloudflare Workers static assets host the app
- Status: proposed 2026-09-29 · Phase 6
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

## ADR 004 — Resend: custom SMTP for sign-in links, broadcasts for alerts
- Status: proposed 2026-09-29 · Phases 6, 8
- **Context**: Supabase's built-in mailer sends 2 emails/hour (*measured*); $15 left after Supabase.
- **Options** (*measured* 2026-09-29): **Resend split** — transactional free 100/day, 3,000/month;
  broadcasts free and unlimited to ≤1,000 contacts, with dashboard compose (the 5.2 outage path).
  **Amazon SES** — $0.10 per 1,000, no minimum, no compose dashboard; sandbox exit is an AWS request
  (*reasoned*). **Resend Pro** — $20/month; breaks the ceiling.
- **Decision**: Resend split; alerts go as per-program broadcasts.
- **Consequences**: broadcasts carry an unsubscribe link, so a parent who unsubscribes still needs push;
  onboarding is staggered across days above ~50 families.
- **Ceiling and next move**: 100 transactional/day and 1,000 contacts → Resend Pro once HSC pays.
- **Kill condition**: broadcasts cannot be triggered by API for a segment, or deliverability to family
  inboxes proves poor in the pilot.

## ADR 005 — A PWA for the pilot; a native coach app is the named move
- Status: proposed 2026-09-29 · Phases 5, 6
- **Context**: cards cached on the coach's device (5.1); iOS web push needs Add to Home Screen
  (*measured*); the owner builds on Windows.
- **Options** (*measured* 2026-09-29): **PWA** — no stores, no Mac, $0. **PWA for families + Capacitor 8
  (8.5.2) for coaches** — Keychain storage, Face ID, APNs / FCM push; $99/yr Apple (nonprofit waiver
  possible) + $25 Google; iOS builds need a Mac or a cloud Mac. **Store apps for all** — organisation
  enrolment needs a D-U-N-S number.
- **Decision**: PWA; cached cards unlocked by a passkey with `userVerification: "required"`.
- **Consequences**: the device passcode is enforced only indirectly; onboarding asks iPhone families to
  install and verifies a test push.
- **Ceiling and next move**: family reachability under 70%, or the passkey gate failing on real devices
  → Capacitor coach app.
- **Kill condition**: the passkey-gated cache cannot work on iOS Safari → printed card pack for away
  regattas, and coaches move to Capacitor.

## ADR 006 — Alerts go by Web Push and email; SMS arrives before LTS
- Status: proposed 2026-09-29 · Phases 3, 6
- **Context**: "never push alone" (forge-idea); MAAPP copying rules; the ceiling.
- **Options**: **Web Push (VAPID) from an Edge Function** — free, no third party holds device tokens;
  **FCM** — free, one path for a later native app, adds a Google project; **OneSignal** — free,
  dashboard send, a third party holds the device list. SMS: **defer** vs **Twilio from day one**
  ($0.0083/segment + carrier fees, $1.15/month number, 10DLC registration — the 10DLC fees partly from
  secondary sources).
- **Decision**: Web Push + email for the pilot; Twilio SMS before LTS joins.
- **Consequences**: per-recipient delivery status is recorded so the health check sees failures.
- **Ceiling and next move**: ~2,500 deliveries per alert at design load → batched sends in the
  function; SMS added for urgent alerts.
- **Kill condition**: in the pilot, a weather alert fails to reach every family by push or email within
  15 minutes → bring SMS forward.

## ADR 007 — React + TypeScript + Vite PWA
- Status: proposed 2026-09-29 · Phase 6
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

## ADR 008 — New repo `coaches-dockbox`; develop / release / main; auto-deploy on release
- Status: proposed 2026-09-29 · Phases 6, 8
- **Context**: cohssa-attendance's Sheet architecture and names-only policy cannot carry this.
- **Options**: **new repo** (clean; salvage copied in); **evolve cohssa-attendance** (keeps history, but
  every settled decision inverts).
- **Decision**: new repo; the workspace branch model (owner directive 2026-09-01) with the house
  `githooks/pre-push`; CI deploys the Worker and applies migrations on merge to `release`.
  cohssa-attendance is **archived** at its own gate, and `policies/cohssa-minor-data-handling.md` moves
  to superseded in the same pass.
- **Consequences**: COHSSA runs spring 2027 on paper.
- **Ceiling and next move**: not applicable.
- **Kill condition**: reopen only if the repo must hold a second deployable.

## ADR 009 — The first real test proves another program's coach is refused a medical card
- Status: proposed 2026-09-29 · Phase 6
- **Context**: the bet (ADR 002) is the riskiest code, and a vacuous green here would be the worst kind.
- **Options**: **cross-program refusal test** against a local Supabase in CI; **salvaged grade/date
  unit tests** (fast, prove nothing about the risk).
- **Decision**: the refusal test, proven failable per `prove-tests`; Vitest for units.
- **Consequences**: CI needs Docker; `ghcr.io` throttling is solved by
  `SUPABASE_INTERNAL_IMAGE_REGISTRY: public.ecr.aws` (cairn note, 2026-09-23).
- **Ceiling and next move**: CI minutes on the free GitHub tier → cache the Supabase images.
- **Kill condition**: the test does not fail when the membership check is removed → it is not testing
  the function; rewrite it before anything else lands.

## ADR 010 — Sentry free for exceptions, a scheduled health check for silent failures
- Status: proposed 2026-09-29 · Phase 5
- **Options** (*measured* 2026-09-29): **Sentry Developer** — 1 user, 5k errors/month, 30-day lookback,
  email alerts; **health check only** — no third party, crashes unseen.
- **Decision**: both; Sentry receives nothing personal (scrubbed before send).
- **Ceiling and next move**: 5k errors/month → sample, or Team $26 once HSC pays.
- **Kill condition**: the scrubbing cannot be verified to strip medical fields → drop Sentry, keep the
  health check.

## ADR 011 — Day-1 seams
- Status: proposed 2026-09-29 · Phase 6
- **Decision**: versioned `supabase/migrations/`; one data module per store (`medical/` the sole caller
  of the medical function); one typed env loader per runtime, failing at boot; scheduled work on
  pg_cron → Edge Functions, each idempotent and catch-up-capable; Vite's current layout re-fetched at
  scaffold; strict TypeScript and a linter from the first commit.
- **Ceiling and next move**: none adds a service; they are boundaries sized to ~1,000 families.
- **Kill condition**: code that has already leaned around a seam — fix the seam, not the caller.

## ADR 012 — The roster comes from Clubspot's API, with a CSV fallback from 2027-02-01
- Status: proposed 2026-09-29 · Phase 3
- **Context**: the owner chose the API (3.3); the key must be requested by another HSC admin (3.5).
- **Options** (*measured* api.theclubspot.com, 2026-09-29): **API** — key by request, club-scoped,
  server-side only; `GET camp-registrations` read-only; participant names, email, mobile, primary +
  secondary guardian contacts; no medical, no birthdate, no webhooks. **CSV import** — manual per
  season; the export carries medical, insurance and address columns. **Hand entry**.
- **Decision**: the API via a scheduled Edge Function; CSV import with a column whitelist if no key by
  2027-02-01.
- **Consequences**: the API is privacy-favourable (it cannot carry the sensitive columns); parents supply
  birth year and medical flags.
- **Ceiling and next move**: undocumented rate limits → poll no more than hourly.
- **Kill condition**: no key by 2027-02-01 → CSV import becomes the pilot's path.

## Charter gate (2026-09-29)

| # | Question | Options offered | Answer |
|---|---|---|---|
| 9.1 | Charter | approve + design-bar next / approve + repo setup / amend / kill | **Approved (ratified 2026-09-29); route to `design-bar` before decomposition** |
| 9.2 | Signature moment | keep as drafted / loosen to 2 minutes / a different moment | **Kept as drafted**: roster in under 60 s; one tap to a missing sailor's guardian or, with no signal, their emergency card |

Next: `design-bar` on the dock experience; then the gated writes, one approval each (repo + scaffold, board, story filing), and the cohssa-attendance archive at its own gate. This log stays until the charter lands in `coaches-dockbox/docs/`.

## design-bar (2026-09-29)

Stage: charter ratified, nothing decomposed → full depth.

| # | Question | Options offered | Answer |
|---|---|---|---|
| D.1 | When attendance happens (multi) | dock talk / trickle-in / at launch / at return | **As sailors trickle in** (*reported*) |
| D.2 | Sailors at a typical JRT practice | <10 / 10–20 / 20–35 / 35+ | **10–20** (*reported*) |
| D.3 | Hands and eyes (multi) | gloves / wet / polarized sunglasses / other hand busy | **Polarized sunglasses; other hand busy** (*reported*) |
| D.4 | Immediately after attendance | launch + water count / launch, done / chase the missing | **Chase the missing ones** |
| D.5 | The bar | one thumb, zero decisions / kids check themselves in / today's screen, faster | **One thumb, zero decisions** |
| D.6 | Signature moment | restate to the trickle / keep the 60-second roll call | **Restated** (charter, workflow 1, handoff and constraints amended above) |

Existing artefact read (cohssa-attendance `src/App.jsx`): three 44 px P / E / L buttons per row, blank =
absent, name tap opens a note, **no path to a guardian**; unselected buttons `#94A3B8` on white (≈ 2.6:1).

Field, *measured* 2026-09-29: Brightwheel — families check children in themselves at a kiosk (4-digit
code or QR) or in-app, staff as fallback. TeamSnap — "availability doubles as attendance … no separate
check-in to confirm who actually showed up" (secondary review). Screen Wake Lock API — "Baseline 2025"
(MDN), needed because the screen stays open for 15–20 minutes of trickle.

**Finding** (design-bar "a control whose only useful position is the default"): P / E / L asks the coach
for information the product already holds — the clock knows late, the RSVP knows excused. Deleting the
choice is what makes one tap possible.

### design-bar phase 3 — the prototype (2026-09-29)

Disposable prototype published privately as the artifact "Dockbox Arrivals"
(https://claude.ai/artifact/LJ5BGqkau1sBfJHpDXAk6i, version 1): invented sailors and 555 numbers, a
stable two-column first-name grid (last initial only where first names collide), one tap = here before
start and late after, excused from RSVP, a repeat tap is harmless, hold = override sheet, a thumb bar
with Arrivals / Still missing (red once practice starts), missing rows with Call / Text / Card, an
emergency card with flags and a "what to do" note, a no-signal mode, and a screen wake lock request.
Deliberately single light theme for glare; Atkinson Hyperlegible Next / Mono.

Verification pass, *measured* in headless Edge via playwright-core 1.63 at 375x812, 375x667 and
320x568, rosters of 1 / 10 / 18 / 35: **93 / 93 checks** after fixing the instrument — contrast (ink on
cyan 6.97, white on red 5.70, every text pair >= 4.5; cohssa-attendance's old unselected grey 2.56), the
tally always sums to the roster, no horizontal scroll, no name crosses its tile edge, labels unique, tile
positions unchanged after five taps, late after start, excused without a tap, every missing row reaching
Call / Text / Card with >= 56 px buttons, Card and hold each one tap, zero console errors.

**The instrument was wrong twice before the page was**: "every name clipped" compared scrollHeight
against a tight line-height (descender overflow, not clipping) and "tiles moved" compared
viewport-relative positions while the test scrolled to reach off-screen tiles. Both re-measured the
right quantity and passed.

**Real finding — lands, but not at every size**: tiles fully visible above the thumb bar with 18 sailors,
after one tightening pass (tile 76 -> 66 px, gap 10 -> 8 px): **14 at 375x812, 10 at 375x667, 6 at
320x568** — a scroll to find a late arriver on smaller phones. Judged on the owner's own phone, not here.
Carrier caveats: `tel:` / `sms:` are unreliable inside an artifact frame, so the prototype shows numbers
instead of dialling; the real app's one-tap call needs verifying on a device (*reasoned*: iOS may add
its own confirm).

### design-bar phase 4-5 — verdict (2026-09-29)

| # | Question | Options offered | Answer |
|---|---|---|---|
| D.7 | Verdict on the dock moment, after the owner tried the prototype on their own phone (reached by QR code) | lands / lands, not at every size / correct and inert / the moment did not survive | **Lands** |

What carries it, *measured* on the prototype: one tap per arrival with no status decision, a grid that
never moves under the thumb, the still-missing list one tap from Call / Text / Card, and every coloured
status at >= 5.7:1 contrast. The recorded size limit (10 of 18 tiles above the thumb bar at 375x667)
did not change the owner's verdict.

Phase 5, where the bar binds: this charter's *Design bar* section, the restated signature moment,
workflow 1, and four handoff constraints (one tap, no status choice; stable order; one-thumbed in
polarized sunglasses; one tap from each missing sailor to guardian and card). groom-backlog carries
`signature_moment` into every story that touches the dock, and each story names the moment it serves
or says it is infrastructure. The prototype stays disposable; the real screen is built through
complete-story from the stories, not ported from the artifact.

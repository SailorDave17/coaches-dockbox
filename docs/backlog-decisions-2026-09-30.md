# Backlog decisions — 2026-09-30

The owner's decisions taken while the ratified charter was groomed into epics and stories
(2026-09-29 to 2026-09-30). Story bodies cite them as **D1** to **D33**. They sit beside the charter,
not in place of it: where one changes a charter line, the story that implements it also amends the
charter, with a dated note.

"Against the recommendation" marks the decisions where the owner chose differently from what was
recommended at the time, so a later reader can tell a deliberate choice from a default.

## Repository and schedule

- **D1 — Public while building, private before real data** *(against the recommendation to go
  private first)*. The repository and its board stay public during the build and are made private
  before the first real sailor's record is written, together with the Supabase Pro upgrade. Every
  issue is therefore written for a public audience: invented people only, no secret or credential
  value, no unfixed weakness and no audit finding.
- **D2 — Planning go-live 2027-04-01.** The charter says spring 2027; the backlog plans against
  April 1.
- **D5 — The local push guard is on** in the owner's clone (`core.hooksPath=githooks`).
- **D6 — A pilot cut line.** Every story is tagged *pilot* or *after go-live*; the owner cuts at
  filing.
- **D7 — Medical deadlines.** The medical block is feature-complete by 2027-03-04, security-audit on
  medical access has passed by 2027-03-11, and the second reviewer's attempt is done by 2027-03-18.
  Missing any date takes ADR 002's contacts-only fallback for the pilot.
- **D8 — Devices.** Real-phone readings use the owner's Android phone and a borrowed iPhone
  (iOS 16.4 or later); arranging the iPhone is its own first-wave task.
- **D32 — Reviewer naming target 2027-03-01** *(against the recommendation of 2027-02-15)*. The
  second reviewer is named by March 1; 2027-03-18 stays the fallback trigger.

## Platform and data

- **D3 — ADR 001's kill condition, read precisely.** A security-definer helper called from an RLS
  policy is allowed when it returns only the caller's own facts, is `stable` with
  `search_path=''`, has execute revoked from public and anon, and is tested. A definer function that
  returns protected rows, or a definer RPC that is the only guard on a read or write, still fires the
  kill condition.
- **D4 — TypeScript 7.0.2 stands** (Dependabot #2); `strict` was already on.
- **D9 — Roster source.** JRT families register as a Clubspot camp, so the API path stands; the CSV
  import stays the conditional fallback.
- **D15 — Sign-ups disabled.** Every account is pre-created by the roster sync or a director.
- **D21 — Technical corrections**, accepted as a set: PR dry runs never touch production; the first
  deploy stores the public build values and loads a started page; hosted auth settings are set and
  read back; a full-access Resend key is stored as a function secret; scheduled jobs are proven at
  the far end; nothing real is written before Pro and the private repo; no family enrols before the
  final domain; invented test people are seeded for live checks and removed before families arrive;
  and related sequencing fixes.
- **D26 — Test people stay until the gates pass.** The invented test people are removed only after
  the security audit, the second reviewer's attempt and the restore rehearsal, whose targets are
  those invented sailors while real flag entry is closed. The first family invite follows.
- **D30 — Repository security settings on.** Secret scanning, push protection, Dependabot alerts
  and private vulnerability reporting were switched on while the repository is public.
- **D31 — Resend Topics.** Since Resend's 2025-11-05 contact change, contacts are global per email
  address and unsubscribes live on Topics. Alerts and team messages therefore use separate Topics
  ("Alerts", "Team messages"), and segments only group a program's recipients.

## Sign-in, medical and safety

- **D10 — The 13+ rule.** A sailor may sign in only when the current year minus their
  guardian-entered birth year is at least 14, so nobody under 13 is ever admitted.
- **D11 — Real medical entry waits for the gates.** Entering real medical flags stays switched off on
  the live project, enforced server-side, until security-audit and the second reviewer have both
  passed. Families join with contacts first.
- **D12 — A logging failure never blocks a card.** If a card view's log row cannot be written, the
  function retries once, then shows the card and queues the view with its original time.
- **D29 — Where security findings go.** A private security advisory while the repository is public;
  once it is private, redacted issues plus full detail in a private file at a location the owner
  names. Never in a public issue.

## Attendance

- **D14 — Any coach marks; the latest mark wins** *(against the recommendation of one holder with
  a take-over; amends the charter's "one taker per practice")*. Each mark records its taker; there is
  no lock. A coach's screen picks up other coaches' marks before the still-missing list shows.
- **D19 — Counting taps.** "One tap from calling or texting their guardian" counts Dockbox's own
  taps; the confirmation iOS shows before dialling is outside the budget.
- **D22 — "Latest" means the latest tap time**, with ties broken by the order the server received
  them, so a save held offline never overwrites a later correction.

## Messages and alerts

- **D13 — Alerts reach sailors 13 and over too** *(against the recommendation of guardians only)*.
  A director marks each alert as an emergency or not; a guardian's stop switch suppresses
  non-emergency alerts to their child, and emergency alerts always get through.
- **D16 — Two thread kinds**: one per program and one per family. Guardians are copied by structure.
- **D17 — Program threads notify by push plus a Resend broadcast** *(against the digest
  recommendation)*, on the "Team messages" Topic (D31).
- **D18 — Family threads notify by push plus one transactional email per message**, counted in the
  shared daily email budget.
- **D24 — The stop switch covers both threads.** A child whose guardian switched it on gets no
  coach-written message in either the program or the family thread; teammates' posts still show.
- **D25 — Over-budget family email queues** to the next club-time day and shows as queued.
- **D27 — Directors belong to their program's thread.**
- **D28 — Invitations carry the sign-in link**, generated server-side, so a same-day first sign-in
  costs no second email.

## Accepted as recommended, as a set (D20)

The 13+ sailor's own email is entered and approved by a guardian; attendance marks are append-only;
a scheduled GitHub Actions workflow notices a health check that stopped running; the still-missing
row calls the primary guardian; the passkey cache's key design follows the real-phone probe reading;
offline card views are queued and uploaded later; a guardian's edit wins over the Clubspot poll; every
current coach reads the whole lesson library; guardians see sailor-visible plans for their children's
programs; the medical note is capped at 280 characters; a tile has one tap target, and the card opens
from the still-missing row, the Sailors list and the long-press sheet; tiles are ordered by first name,
then last name; tow slots are open to the families of the programs going to that regatta; every screen
carries the accessibility check; and the cohssa-attendance archive story was dropped because the
archive was already done.

- **D23 — Contrast.** At least 7:1 for text on paper and pale backgrounds; at least 4.5:1 on
  brand-coloured controls, where the cyan always carries dark ink.
- **D33 — Verification fixes applied.** An adversarial check of the groomed set (2026-09-30)
  confirmed 84 findings; every fix was applied before filing.

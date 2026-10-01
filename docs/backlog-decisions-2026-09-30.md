# Backlog decisions — 2026-09-30

The owner's decisions taken while the ratified charter was groomed into epics and stories
(2026-09-29 to 2026-09-30). Story bodies cite them as **D1** to **D33**. **D34** to **D67** were taken
on 2026-09-30 at the boat-repair forge and at the gates of its groom, and the boat-repair epic's
stories cite them. They sit beside the charter, not in place of it: where one changes a charter line,
the story that implements it also amends the charter, with a dated note.

"Against the recommendation" marks the decisions where the owner chose differently from what was
recommended at the time, so a later reader can tell a deliberate choice from a default.

## Repository and schedule

- **D1 — Public while building, private before real data** *(against the recommendation to go
  private first)*. The repository and its board stay public during the build and are made private
  before the first real sailor's record is written, together with the Supabase Pro upgrade. Every
  issue is therefore written for a public audience: invented people only, no secret or credential
  value, no unfixed weakness and no audit finding.
- **D2 — Planning go-live 2027-04-01.** The charter says spring 2027; the backlog plans against
  April 1. *(Moved to 2027-04-28 by D39, 2026-09-30, when boat repairs joined the pilot.)*
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

## Boat repairs (2026-09-30, afternoon and evening)

Taken at the boat-repair forge (D34 to D38, recorded in `docs/forged-idea-boatwork-2026-09-30.md`)
and at the gates of its groom (D39 to D67).

- **D34 — Boat repairs join the pilot** *(against the recommendation of a form now and the Dockbox
  version later, with the COHSSA and Learn to Sail onboarding)*. A coach reports a broken club boat
  and when it happened. The boat crew (sailboats) or the safety chair (motorboats) is emailed at
  once, one of them claims it, and it returns to service when fixed. This adds a core workflow to
  the charter.
- **D35 — Every club coach reports**, COHSSA and Learn to Sail coaches included, before their
  programs join. They hold a repair-only role, never coach or director, with no roster and no
  sailor data. COHSSA and Learn to Sail exist as programs during the pilot, with reporter
  memberships only.
- **D36 — One claimer at a time.** A small mixed group fixes sailboats, so one person at a time
  claims a report, by a conditional write (the tow-slot pattern).
- **D37 — The reporter may take a boat out of service** by severity, sailboats and motorboats alike.
- **D38 — The non-JRT bet and its fallback.** The fallback is taken two weeks after go-live if
  fewer than half of the non-JRT coaches given accounts have signed in once, or as soon as a repair
  is found reported by text. Those coaches then report through the fallback form, which is the
  Clubspot form (D40), not the Google Form first named.
- **D39 — Go-live moves to 2027-04-28** *(amends D2)*. The whole repair set stays in the pilot; the
  cut to a 7.75-day core was rejected. The date is the planning page's scheduler on the final set at
  5 engineer-days a week. It is 2027-04-23 if the CSV-import and consent stories do not fire. D7's
  medical dates are unchanged. So is D32's reviewer trigger, 2027-03-18: the charter's recorded
  unknowns word it as "go-live minus two weeks", counted from the old 2027-04-01.
- **D40 — A Clubspot repair form now, and as the fallback.** Clubspot has no repair module, but a
  members-only Clubspot form emails a fixed list on each submission. A Clubspot admin puts one up
  now, before any Dockbox repair code. It bridges until Dockbox's report is live, then serves as
  D38's fallback.
- **D41 — One optional photo per report** *(against the recommendation of none)*.
  - Kept in private storage.
  - Visible only to the routed crew or chair, the claimer and the reporter.
  - Never attached to an email.
  - Deleted when the report is fixed or closed.
- **D42 — The safety-boat ratio is display only** in the pilot. A ratio rule is a later-release
  question.
- **D43 — One boats table, with a director fleet screen** *(against the recommendation of an owner
  command only)*. The command stays for tests and seeding. Towing (#72) picks a trailer's boats
  from the same table.
- **D44 — An owner-only club-roles screen** *(against the recommendation of an owner command)*. It
  creates, dates and removes the boat crew, the safety chair and the COHSSA and Learn to Sail
  reporters, and sends reporters' invites. Every role ends on a date.
- **D45 — Club-role holders may report too.** The crew and the chair can file a report and take a
  boat out of service.
- **D46 — #43 keys roster reads on role** (coach and director). It is amended before it is built.
- **D47 — Severity is one "Not safe to sail" switch**, beside a one-line guideline the safety chair
  writes.
- **D48 — The speed bar.** At most 4 taps plus one typed line, in an automated phone-sized check.
  One more tap is allowed for out of service, and an optional photo is not counted. A real-phone
  timing against a text message backs it.
- **D49 — A boat-only hint and an incident pointer** *(against the recommendation of the hint
  alone)*. The hint reads "the boat only: no names, faces or injuries". The pointer leads to the
  club's incident process, which is named before the report screen ships.
- **D50 — A report can close without a fix.** The claimer, or the routed group, closes it as a
  duplicate or not needed, with a reason. Closing releases any out-of-service flag.
- **D51 — Repair email is never held.** The crew or chair email and its re-sends join owner alarms
  as the daily budget's never-held kinds, still counted.
- **D52 — Repair email links to the report.** Claiming or clearing needs a normal sign-in. No
  sign-in link or claim token goes in repair email.
- **D53 — Re-send.**
  - Out-of-service reports are re-sent after 2 days and others after 7, both configurable.
  - Unclaimed reports go to the routed group, and claimed ones to the claimer.
  - Each run sends one bundled email per recipient.
- **D54 — Down boats show three ways** *(against the recommendation of no extra email)*:
  - a Repairs home, with down boats first
  - a section on the before-practice view (#79)
  - an email to every current coach when a boat goes out of service (recipients in D63)

  The Dock screen is untouched.
- **D55 — The every-coach notice uses the normal budget.** When over it, the notice queues to the
  next club day, as D25 does. Only D51's email is never held.
- **D56 — Recorded here before filing.** These decisions are recorded here before the boat-repair
  stories are filed, and story bodies cite their D-numbers.
- **D57 — Develop's red CI gets its own story** under the release-pipeline epic (#5): the Supabase
  image pulls must survive registry limits. It is #143, filed that evening at the sailor-pathway
  groom, where the owner made the same call (decision 4 on #135); the boat-repair set files no
  second one.
- **D58 — Failure metric 1 is read for repairs at season end**, in the repair epic. The go-live
  epic (#17) records that metric 1 is unread for every other job. *(Refined by D66.)*
- **D59 — Staff under 18 are marked, and get no app email.**
  - The owner sets "under 18" yes or no for each reporter and club-role holder on the club-roles
    screen, with no birth date.
  - An under-18 reporter still reports and sees Repairs.
  - They get no app email beyond the sign-in invite, no every-coach notice, and no club role.
  - The same flag serves the sailor-pathway epic.
  - *(Extended by D64 and D65: the mark is held on the person and is also set on #90's roster
    screen, every repair and out-of-service email skips anyone marked, and nobody marked holds a
    coach or director membership.)*
- **D60 — An admins table names the owner.** It holds the owner's person row, is writable only by
  the server, is seeded by the bootstrap command (#63), and is checked by a tested policy helper.
  Handing the job to HSC later means changing one row.
- **D61 — The Clubspot form routes by boat kind**: by a field if Clubspot can, otherwise two forms.
- **D62 — Repair photos are not media of sailors.** The boat-only hint, the restricted visibility
  and deletion on fix or close cover them, recorded as a dated charter note. Consent to film minors
  stays deferred with video.
- **D63 — Who gets the every-coach notice.** D54's out-of-service email goes to each person who
  holds a current coach, director or repair-reporter membership in any program, once however many
  they hold, and never to anyone marked under 18 (D64). Holding a club role adds nobody to the
  list: the boat crew and the safety chair already get the repair email (D51).
- **D64 — The under-18 mark is held on the person** *(extends D59)*, not on a club role or a
  membership. It is set on the club-roles screen and on the director's roster screen (#90, amended
  at filing). Every repair and out-of-service email, re-sends included, skips anyone marked. The
  sailor pathway (#135) reuses the mark as its record of staff age (D65).
- **D65 — One answer for staff under 18**, joining D64's mark to decision 2 on #135. The mark
  records age, and the assistant role (#145) is what a marked 16- or 17-year-old holds in a
  program.
  - The database refuses a coach or director membership for anyone marked under 18, whatever path
    writes it: the roster screen (#90), the bootstrap command (#63) or the club-roles screen.
  - It also refuses to mark under 18 anyone who holds a coach or director membership.
  - So nobody marked holds a coach's or a director's access, or gets the email those roles get.
  - #145 is amended at filing to require the mark: an assistant membership is refused unless the
    person is marked under 18.
  - Marked staff still report repairs and see Repairs (D59).
  - #21's deciding unknown on staff age is amended at filing to point here.
- **D66 — Who counts in the repair reading of failure metric 1** *(refines D58)*. A program that
  declined at the Learn to Sail and COHSSA confirmation is left out of both counts, the repairs
  learned of outside Coaches' Dockbox and all the repairs handled, since the app never claimed that
  program's reporting. A program that agreed still counts, even once D38's fallback has fired. The
  counts are split by program.
- **D67 — One "Boat repairs" epic** holds all 30 stories. It is split, not stretched, once it
  passes about 30 stories, the soft cap an epic here is held to.

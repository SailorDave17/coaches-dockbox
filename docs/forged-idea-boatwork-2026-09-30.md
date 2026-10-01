# Forged idea: boat repair tracking (2026-09-30)

## Metadata
- Status: `forge-idea` verdict **hardened, with one bet**, accepted by the owner 2026-09-30.
- Owner: HSCCo
- Source: `forge-idea` run 2026-09-30, main thread in a cairn session; no workflow dispatched.
- Next, chosen by the owner: `groom-backlog` for a new **pilot** epic whose stories amend the
  charter. `design-bar` was offered first and not chosen; the one experience bar (below) goes in as
  an acceptance criterion instead.

## The idea, verbatim
"I have another feature to add. It will have a boatwork tracking feature. This will be for tracking
what boat repairs need done, and when the need for repair happned. Alos, add a section for motorboat
repairs needed (this will mostly be for reporting repair needs to the saftey char) for the boatwork
tracking an email will be sent to certain parties to notify them in case they didint look at the app.
same will be the case for the safety chair person for the motorboat fixes"

## What survived, in one sentence
Any HSC coach reports a broken club boat from the dock with when it happened. If it's severe, they
mark it out of service. The boat crew (sailboats) or the safety chair (motorboats) is emailed at once,
one of them claims it, and it returns to service when fixed. Every coach sees what is down before
practice.

**The growth, stated:** it got bigger, not different. The claim step, out-of-service by severity and
club-wide reporters each came from an owner answer below.

## Owner answers that reshaped it (*reported*, 2026-09-30)
- Today a repair report **"often gets lost"**: no consistent path, boats go out broken or sit
  unfixed.
- Club sailboats are fixed by **a small mixed group**, not one person. That forces a claim step.
- The fleet is **club-owned and shared** by Learn to Sail, JRT and high school, so the feature is
  club-wide.
- Motorboats, verbatim: "Option to mark it out of service (depending on the severity} + chair".
  Applied to sailboats too, by the same reasoning (*reasoned*; not separately asked).
- **In the pilot, with all club coaches reporting** *(against the recommendation of a Google Form
  now and the Dockbox version later, alongside LTS/COHSSA onboarding)*.

## The announcement (phase 2)
> Something broken on a club boat? Report it from the dock in under a minute. Pick the boat, say
> what's wrong and when it happened, and if it isn't safe to sail, mark it out of service. The boat
> crew gets an email right away, even if nobody opens the app. One of them taps "I'm on it", and
> when it's fixed the boat goes back in service. Before practice, every coach can see which boats
> are down.
>
> Motorboats go to the safety chair. A coach reports a dead engine or a soft tube, the safety chair
> is emailed, and if it was marked out of service, nobody takes it out until it's cleared. Every
> report keeps its dates (broke, claimed, fixed), so the club can see what's waiting and what keeps
> breaking.

The sentence a coach would repeat: *"I reported the cracked rudder from the dock, it was fixed by
Saturday, and nobody took that boat out in the meantime."*

**Experience or mechanism:** mostly a mechanism (report, route, claim, clear). There is one
experience bar: **reporting must be faster than texting someone**, or coaches keep texting.

## Load-bearing claims
| # | Claim | Tag | Evidence | Status | Would be shown wrong by |
|---|---|---|---|---|---|
| 1 | Repair reports get lost today | *reported* | The owner | Holds | A season's texts show every reported breakage was fixed |
| 2 | Nothing already tracks this for HSC | *measured* | Tracker: no story or epic covers repairs; only towing (#15, #72, #86) touches boats. Clubspot's booking product lists boat reservations and nothing on maintenance, damage or repair (theclubspot.com/product-booking, fetched 2026-09-30) | Holds | Clubspot ships a maintenance module (only the booking page was read) |
| 3 | Someone owns each report to "fixed" | *reported* | A small mixed group | Holds, **with a claim step** | Reports sit unclaimed for weeks in the first month |
| 4 | Coaches outside JRT will sign in to report | unchecked | Not checkable before they have accounts | **The bet** | See the fallback trigger |
| 5 | Email reaches the crew and safety chair in time | *reasoned* + *reported* | Volume is a few a week. The 100/day Resend transactional cap is shared with sign-in links (charter, as of 2026-09-29), and D25 queues over-budget email to the next day | Holds **only if** repair email skips that queue | A repair email waits for the next day's budget |
| 6 | Non-JRT reporters add no medical exposure | *measured* | `can_view_medical` admits `coach`/`director` of the sailor's program and season (`supabase/migrations/20260929200000_init_medical_access.sql` lines 52-72) | Holds in the pilot; **fails after #21** if reporters hold `coach` | A repair-only reporter passes `can_view_medical` |
| 7 | It fits in the pilot | *measured* + *reasoned* | Pilot slack 4.15 calendar days (sailor-pathway forge, same day); ~7.5 engineer-days ≈ 10.5 calendar days at 5 a week | **No.** Go-live moves to about 2027-04-07. The medical dates (D7) hold if repair stories come after the medical block | — |

## The bet and its fallback
- **Bet:** coaches outside JRT sign in to Dockbox to report repairs before their programs join.
- **Fallback:** a Google Form that emails the same boat crew and safety chair, for anyone not yet in
  Dockbox.
- **Take it** two weeks after go-live if fewer than half the non-JRT coaches given accounts have
  signed in once, or the moment a repair is found reported by text instead.

## Where it lands
- **The JRT pilot, as a new epic beside Towing (#15).** It shares towing's boat record. Neither
  exists yet; #72 plans boats inside the trailer setup.
- **A charter amendment**, made by the implementing story with a dated note (the
  `backlog-decisions` convention). It adds a core workflow, adds club-wide repair roles to Users &
  access, and means repair reporting now counts toward failure metric 1 ("other apps still used
  for ≥30% of the jobs Dockbox claims").
- **Rough shape** (*reasoned*, not groomed), about 7–8 engineer-days:
  - fleet registry (sailboats and motorboats), 1 d
  - repair roles, 1 d
  - report from the dock, 1.5 d
  - routed email, 1 d
  - claim and fix, 1 d
  - out-of-service before practice, 0.5–1 d
  - re-send stale repairs, 0.5 d
  - onboard non-JRT reporters, 0.5–1 d

## Design rules the evidence forced
1. **Non-JRT reporters get a repair-only role, never `coach`.** `can_view_medical` must stay keyed on
   `coach`/`director`, so a repair role can never reach a medical card after COHSSA and LTS join.
2. **COHSSA and LTS exist as programs during the pilot**, holding reporter memberships only and no
   sailors.
3. **Repair and out-of-service email skips D25's next-day queue** or has reserved headroom.
4. **The email carries enough to act on without opening the app**: boat, what's wrong, when it
   happened, out of service or not, and who reported it. It also links to the report.
5. **Two dates:** when it was reported (automatic) and when it happened (the reporter's entry, which
   can be "not sure").
6. **Claim before fix.** One claimer at a time, so two crew members never work the same job
   unknowingly (conditional write, the tow-slot pattern).
7. **Stale open repairs are re-sent** after N days, as a scheduled job (#41's pattern). An
   out-of-service flag nobody clears teaches coaches to ignore flags.
8. **Out-of-service boats show where the coach already looks before practice**, not only on a
   repairs page.
9. **The report is faster than a text**: a few taps from a phone, the same bar as attendance.

## Rejected, with the reason
- **A Google Form now, the Dockbox version later with LTS/COHSSA onboarding** (the recommendation).
  The owner chose the pilot; the Form survives as the fallback.
- **A later release with no bridge.** Reports keep getting lost until summer 2027.
- **A Form only, no Dockbox feature.** No claim step, no out-of-service flag coaches see, and one
  more app outside Dockbox.
- **RigReport** ($2,500 setup + $199 a year, *reported* from a search snippet; the site renders by
  script and was not read). Another app, and the setup cost alone exceeds the $40/month ceiling many
  times over.
- **SpeedyDock**. Membership boat-club software with issue logging and out-of-service flags; built
  for rental clubs, and another app.
- **"Only the safety chair sets status."** The owner chose a reporter-set flag by severity; a
  report must not sit unflagged until the chair acts.
- **Giving non-JRT reporters the `coach` role.** Claim 6.

## Still unchecked
- Who the boat crew and the safety chair are, and whether they agree to take the email and clear
  flags. Their decision, so this is externally gated.
- Whether the LTS director and COHSSA coaches agree to report in Dockbox before their programs join.
  Also externally gated, and the same people the sailor-pathway forge needs.

### Resolved after the forge (2026-09-30, the groom and its gates)
- **What "severe" means**: one "Not safe to sail" switch, beside the safety chair's one-line
  guideline (D47).
- **Whether an out-of-service motorboat blocks anything**: display only in the pilot (D42).
- **Photos**: one optional photo per report, against the recommendation of none (D41, D62).
- **Whether Clubspot has a maintenance module**: no. A three-angle search plus a skeptic read every
  Clubspot product, pricing and help page, 160 blog posts, and clubs that run on Clubspot. None has
  a repair, damage or out-of-service feature. A members-only Custom Form, which emails a fixed list
  on each submission, covers the report-and-email half, so it became the bridge and the fallback
  (D40).
- **The Resend daily cap**: the groom's code grounding rechecked it on 2026-09-30, and it is still
  100 transactional emails a day on the free tier.

## After the forge: what the groom changed (2026-09-30)
- **The price was wrong by more than double.** This doc sized the build stories alone at 7–8
  engineer-days. The set as filed is priced at **22.25 engineer-days in 30 stories, 21.25 of them
  before go-live**. The extra comes from:
  - the verification and live-setup stories
  - the two owner confirmations
  - the dock timing
  - the reporter provisioning
  - the post-go-live readings
  - the scope the gates added (the photo, a director fleet screen, an owner-only club-roles screen,
    an every-coach notice, the incident-process pointer, and the under-18 mark)
  - the tests, refusals and live checks an adversarial check of the set added before filing

  Go-live moves to 2027-04-28 (D39), not the 2027-04-07 estimated above.
- **The fallback changed.** A Clubspot form now serves as the bridge until Dockbox's report is
  live, and then as the bet's fallback (D38, D40). It replaces the Google Form, which needed a
  club-owned Google account.
- **Under-18 staff** are marked on the person, on the club-roles screen or the director's roster
  screen (D59, D64). Every repair and out-of-service email skips anyone marked, and a marked
  reporter gets no app email beyond the sign-in invite. Nobody marked holds a coach or director
  membership: a marked instructor aged 16 or 17 holds the sailor pathway's assistant role (#145)
  instead (D65).
- **The every-coach notice** goes to every current coach, director and repair reporter not marked
  under 18, once each (D63).
- **Failure metric 1's repair reading** leaves out a program that declined at the Learn to Sail
  and COHSSA confirmation (D66).
- The gate decisions are D34 to D67 in `docs/backlog-decisions-2026-09-30.md`.

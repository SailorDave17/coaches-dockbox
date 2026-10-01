# Forged idea: the HSC sailor pathway (2026-09-30)

## Metadata
- Status: `forge-idea` verdict **hardened, with one bet**, accepted by the owner 2026-09-30. The
  version first described ("identify the best candidates") was **killed** in the same run.
- Owner: HSCCo
- Source: `forge-idea` run 2026-09-30 in cairn; research workflow `wf_98e96ad1-7a8` (5 read-only
  lenses, 123 findings, all 75 load-bearing ones re-read at source: 29 confirmed, 46 corrected,
  0 refuted). Record: cairn `runs/2026-09-30-forge-idea-hsc-sailor-pathway.md`.
- Stage 1 plan for the program heads: "HSC Sailor Pathway Plan", held by the owner (its link is
  kept out of this public repository).
- Next, chosen by the owner: `design-bar` on the recording moment, then `groom-backlog` for a
  later-release epic.

## The idea, verbatim
1. "I have an idea but I need some help with how it would be implemented and or put forth so here's
   the scenario in high school sailing we would identify people that would be good candidates for JRT
   I want a way to identify them and give notes and track their progress things of that nature so we
   can use that information to identify the best candidates for JRT also I feel like we could use
   something that tracks progress and things like that for athletes anyway so that's the idea I'm not
   sure the best implementation or the best way to use it I need your help"
2. "this idea should also include looking at people who are taking learn to sail and identifying them
   as good candidates for JRT as well."
3. "It should also be backwards compatible. So for instance, if there's someone that is participating
   in JRT, we should use it to make sure that they are a good candidate for high school sailing."

## What survived, in one sentence
Every HSC sailor gets one skills record that follows them across Learn to Sail, JRT and high school
sailing; coaches tick observed skills against a written checklist per transition, and at each
season's end every sailor who is ready and has not been asked is invited by their own coach. Nobody
is ranked.

**The drift, stated:** the output moved from "the best candidates" to "everyone ready, invited".
The owner's own answers drove it (JRT has room for everyone ready; kids do not know JRT exists).

## Owner answers that reshaped it (*reported*, 2026-09-30)
- JRT entry is "a hybrid of all of the above, but oftentimes kids don't know about JRT"; JRT has room
  for everyone who is ready.
- Families hear about JRT only when a coach happens to mention it, or from other JRT families.
- The pains: forgetting who stood out; coaches' views never pooled; sailors not knowing their next
  steps. Not chosen: justifying a pick.
- "Good candidate for high school sailing" means ready for high school racing.
- Note-takers include Learn to Sail instructors.
- Visibility: split. Coach-private observations, plus next steps the sailor and family see.
- Buy-in is needed from the Learn to Sail director and instructors and from the high school coaches
  (COHSSA). "Put forth" meant guidance on implementing it, not a pitch.

## The announcement (phase 2)
> Every Hoover sailor gets a skills passport that follows them from Learn to Sail to JRT to their
> high school team. Instructors tick skills off as sailors show them: rig on your own, sail upwind
> with control, right a capsized boat. Coaches add a short dated note when something stands out. At
> each season's end, the next program's coach gets a list of sailors who are ready and haven't been
> asked yet, and each family gets an invitation from their own coach.
>
> Sailors and parents see the same passport: what they've mastered and what to work on next.
> Coaches' private notes stay with coaches. Nobody is ranked, and every sailor who's ready gets asked.

The sentence a parent would repeat: *"Her instructor told us she's ready for the race team. We didn't
even know Hoover had one."*

**Experience or mechanism:** an experience, at two moments: the family invited by their own coach,
and the end-of-session skill tick on the dock. The second is the bet, so `design-bar` judges it
before any story is written.

## Load-bearing claims
| # | Claim | Tag | Evidence | Status | Would be shown wrong by |
|---|---|---|---|---|---|
| 1 | Ready sailors miss JRT because nobody asks them, not because of selection | *reported* + *measured* | HSC's JRT page: "Can I join JRT if I don't know how to race? Absolutely. We will teach you!"; the high school page says the same (both rendered 2026-09-30) | Holds | Every LTS and HS family is told about JRT for a season and JRT intake does not rise |
| 2 | Observations are lost between seasons and programs | *reported* | The owner | Holds | A season-end list written from memory matches one built from records |
| 3 | Coaches and instructors will record at practice | unchecked | Not checkable before a real season | **The bet** | Fewer than half of sessions produce any entry in the first three weeks of the first trial season |
| 4 | A "best candidate" or "potential" rating is a usable signal | *measured* | 89.2% of international U17/18 juniors did not become international seniors (Güllich 2023, Sports Med); scouts' potential ratings α 0.02–0.09 (Lüdin 2023); prediction is weakest before and during puberty (ISSP 2009) | **Killed** | — |
| 5 | Dated ticks of current skills against written anchors are consistent enough to invite on | *measured* | Two coaches scoring against written criteria agreed at r = .84–.90 (volleyball, 2019); current-performance ICC .61 against .37–.42 for potential (Peringa 2026, abstract only) | Holds | Paired HSC coaches' ticks for the same sailors disagree often |
| 6 | Teen LTS instructors can take part safely | *measured* | The 2026 SafeSport Code weighs evaluative authority as a power imbalance, even between athletes; USA Gymnastics advises against a minor holding authority over a minor close in age; US Sailing certifies Level 1 from 16 (Sailing Assistant until 18) and requires SafeSport only from 18 | Holds, narrowed to objective skill ticks for their own students | — |
| 7 | It fits in Dockbox without hurting the JRT pilot | *measured* | Pilot slack 4.15 calendar days (9.05 if #91 and #110 do not fire) against 3.5–10 days of work; LTS joins summer 2027 at the earliest, COHSSA fall 2027 | Only as a later release | — |

## The bet and its fallback
- **Bet:** recording is cheap enough to happen at practice: skills tapped, not paragraphs typed.
- **Fallback:** drop continuous recording. At the end of each Learn to Sail week and each season,
  every instructor hands in one list against the published checklist: ready for JRT, next level, or
  not yet.
- **Take it** if fewer than half of sessions produce any entry in the first three weeks of the first
  trial season. COHSSA spring 2027 is the earliest.

## Where it lands
- **Stage 1, now to spring 2027: no software.** Checklists agreed with the program heads; a JRT
  paragraph in every LTS and HS family email; one registration line saying coaches record skills and
  readiness across HSC's programs; a club-owned Google Form that coaches submit and only the JRT
  director reads, with a delete-by date, **never imported into Dockbox**. The shared plan carries the
  drafts.
- **Stage 2, the JRT pilot, spring 2027: nothing added.** One deciding unknown belongs in #21: staff
  age is not recorded, so decide how staff under 18 are represented before Learn to Sail instructors
  get logins. *(The measured detail of this finding is held privately under D29 while the repository
  is public.)*
- **Stage 3, a later release beside #21 and #19.** Sailor-keyed skill checkpoints and dated notes.
  About 3.5 engineer-days for JRT-only coach-private notes, 8–10 with cross-program referrals, plus a
  charter amendment (*reasoned*, sized against #71, #84, #43 and #112). The progress half reshapes
  #19 into a growth slice that needs no video; coach notes and candidate flags need the amendment,
  because no story may re-decide the charter.

## Design rules the evidence forced (stage 3)
1. No ranking and no "potential" field: current skills, plus a dated "ready for X" that can be
   withdrawn.
2. Two kinds of note: coach-only, and family-visible next steps. A note a 13+ sailor can read is
   adult-to-minor electronic communication under MAAPP, so guardians see it at the same moment; no
   sailor-only view, no reply thread, and the stop switch covers it (the #70 and #109 pattern).
3. Teen instructors tick objective skills for their own students only: no free text, no reading
   other notes, no "ready" calls. This needs a staff age attribute or an assistant role (stage 2).
4. A "this is a concern" route out of the notes into SafeSport reporting: adults report suspected
   child abuse immediately to law enforcement and the Center, and the club runs no parallel
   investigation (2026 Code, section X).
5. Show age and years sailing where a "ready" call is made. Cueing age at the moment of judgement
   removed relative-age bias; knowing birthdates did not (Mann & van Ginneken 2017).
6. A retention class, an edit history, and a hold while a SafeSport matter is open. Today a note
   table left out of #112 would be kept forever.
7. Link Techscore's public high school results; never re-enter them (results are Burgee's, a charter
   non-goal).
8. The receiving coach forms a view before reading the notes (a randomised study of stigmatising
   chart notes, J Gen Intern Med 2018, applied by analogy).
9. Identity before any cross-program read: Clubspot's participant id is not documented as stable
   across registrations, and another club's integration had to dedupe children by name and date of
   birth, so one child may become two `people` rows.

## Design bar for the recording moment (`design-bar`, 2026-09-30)

The bet is recording, so `design-bar` judged that moment before any story.

| # | Question | Options offered | Answer |
|---|---|---|---|
| R.1 | When an instructor realistically records | end of session on the dock / during practice / later that day at home / once a week | **Later that day, at home** (*reported*) |
| R.2 | Sailors one instructor watches | up to 6 / 7–10 / 11–15 / 16+ | **16 or more** (*reported*) |
| R.3 | Phone during a session | on them / ashore or in a bag / coach boat only | **On them** (*reported*) |
| R.4 | What makes them skip it | kids waiting for pickup / unsure what to look for / feels like homework / phone wet, dead or no signal | **Feels like homework; phone wet, dead or no signal** |
| R.5 | The bar | same evening, one pass / same plus a tap on the dock / a weekly grid / a voice note on the way home | **Same evening, plus a tap on the dock** (the recommendation was the evening pass alone; overruled) |
| R.6 | Verdict on the prototype, tried on the owner's phone | lands / lands, not at every size / correct but inert / the moment didn't survive | **Lands** |

**The moment**, in one sentence: at home that evening, an instructor records what their 16+ sailors
showed today in well under a minute, without it feeling like homework. The evening is a different
moment from the dock: seated, two hands, indoor light. What it must defeat is effort and decisions,
not glare.

**The bar, as set**:
- The evening log opens on the skill tonight's lesson plan names, lists only the sailors marked here,
  in the attendance order, and asks one question per skill ("Who righted a capsized boat with no
  help?"). One tap means "showed it today": binary and positive only, with no "needs work" state.
  "Everyone", then flip the exceptions. One or two planned skills a session, never the whole checklist.
- Saving shows an adult who now meets a transition's checklist, with one step to invite their families.
  Readiness is computed from the recorded ticks and confirmed by an adult; nobody types it.
- **Plus a tap on the dock**: at de-rig, one tap flags a sailor as having shown tonight's skill, and the
  evening log arrives pre-ticked. It must not change the Arrivals tap (one tap marks a sailor here, zero
  decisions), so it lives in its own view on the same stable tiles. Taps only: no long-press, swipe or
  drag, because a wet screen misfires. Never while a coach boat is under way.
- It works with no signal (ticks queue and sync, stamped with the session, never re-keyed) and never
  puts a sign-in wall in front of a tick.
- Each tick is a dated event carrying observed-on, recorded-at, the recorder and their role. Status is
  derived from events, never overwritten. A late entry or a baseline for a sailor already in JRT is
  allowed and labelled as such.
- Instructors under 18 see only their own group, tick objective skills, and write no notes and no
  "ready" calls. An adult can revoke a tick, with a trace.

**Measured on the prototype** ("Dockbox Skills Log", https://claude.ai/artifact/W1gjxP4qdByZiGVNjYag3E,
disposable): 180 of 180 checks in headless Edge at 375×812, 375×667 and 320×568 with groups of 1, 8,
17 and 30. Everyone plus six exceptions logs 11 of 17 in 8 taps; ticking everyone moves no tile; every
text pair is at least 4.5:1. The check itself was wrong twice before it was right: its controls sat in
a closed section, and it asked for a sailor not in the sample. **Size finding**: at rest, 15 of 17
tiles show whole at 375×812, 9 at 375×667 and 6 at 320×568, after one tightening pass (from 9, 3 and
2); a ten-letter name wraps onto two lines in the three-column grid. The dock-tap view was not
prototyped; it is judged at its own story's verification step.

**Evidence behind the bar** (a six-agent research pass, all 45 load-bearing claims re-read at source,
31 corrected, 0 refuted; details in cairn's
`memory/reference/recording-skills-for-a-group-quickly-2026-09-30.md`): skill-first bulk marking with
exceptions is the shipped fast path (iClassPro, Jackrabbit, brightwheel, ClassDojo); no product
pre-fills both the plan's skills and who is present; qualified coaches recalled 59% of critical events
even with notes, while delay alone did not hurt a single rating, so load is the enemy, not hours; a
paper card set a 100% completion bar in one small pilot; water makes taps unreliable; voice is
overheard on a dock.

**Kill condition, sharpened**: fewer than half of sessions with any entry in the first three weeks of
the first trial season, read per instructor and per group as well as per session.

**Open for the stories**: whether families see ticks immediately, in a summary at pickup, or only as
"next steps"; whether an under-18 instructor's ticks wait for an adult before families see them;
whether one skill scale runs from Learn to Sail through JRT to high school with each program as a band
on it; whether a shown skill stands indefinitely or must be seen again each season; the club's rule on
phones while supervising; and how lesson plans name the session's focus skills.

## Rejected, with the reason
- **Ranking, candidate scores and potential ratings.** Claim 4, and HSC's entry is open.
- **Evaluation software** (TeamGenius $1,050–1,500 a year; SkillShark $5–15 per athlete a year).
  Built for tryouts and rankings HSC does not run; another app, which is the pain Dockbox exists to
  fix; over the $40 ceiling at club scale.
- **Checklick** ($15 per coach per month, currency unstated) and **SailCoach** (beta, UK; coaching
  free; sailor-controlled, no coach-private notes). Each is another app, and neither holds three
  programs' coach notes.
- **US Sailing Skill Up.** Its organisation skill tracking is disabled during a 2026 platform move.
  Recheck before LTS joins Dockbox.
- **Notes on the emergency card.** Every review would be a logged card view, flagged by #122's
  non-event-day digest.
- **Adding it to the pilot.** Claim 7, and two of the three directions have no data in the pilot.
- **Teen instructors writing judgements or candidate calls.** The SafeSport power-imbalance factor;
  peers would be judging peers.
- **Importing the stage 1 Form into Dockbox.** Rule 9; re-enter the few live candidates by hand.

## Still unchecked
- Is the Youth Classes page's "Intermediate before race-team practice" rule current? The page shows
  2025 dates beside a 2026 schedule. Is its "Advanced Race Team" the same program as JRT?
- Which HSC coaches hold memberships in more than one program? A dual-program coach already reads
  both rosters under #43.
- Are any COHSSA coaches school employees? A note a school keeps can become a FERPA education record.
- How long a development note lives after a sailor's last season.
- Whether HSC is a US Sailing affiliated organisation, which is how MAAPP reaches the club.
- Whether LTS and COHSSA register through Clubspot camps as JRT does (D9 covers JRT only).
- Whether US Sailing's new platform restores skill tracking before LTS joins.

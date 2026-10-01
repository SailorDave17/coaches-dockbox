# Coaches' Dockbox

Read [`docs/charter.md`](docs/charter.md) before changing anything. It is the document of record:
the problem, the pilot scope, the non-goals, the design bar, and one ADR per technology decision in
[`docs/adr/`](docs/adr/), each with the options it rejected and the condition that would reopen it.
[`docs/discovery-log.md`](docs/discovery-log.md) is the question-by-question history, frozen.

Do not re-decide a charter decision inside a story. If one looks wrong, say which ADR and why; its
kill condition says what would reopen it.

## Constraints no story may break

These are the charter's handoff constraints, verbatim in intent:

- The medical-flags table is denied to every client role; only the medical Edge Function reads it,
  and every emergency-card view writes a view-log row (who, which sailor, when).
- No private coach-to-minor messaging; every message to a minor copies their guardians (SafeSport).
- Sailors under 13 never sign in; the 13+ gate uses birth year.
- Alerts go out by push **and** email; never push alone.
- A tow slot can never be held by two volunteers (conditional write).
- Medical flags, emergency contacts and birth year are purged at the end of the sailor's last season.
- Cached emergency cards cover today's event only, are encrypted, passkey-unlocked, and wiped after
  the event and on sign-out.
- Roster import stores whitelisted fields only; medical, insurance and address columns from a
  Clubspot CSV are never stored.
- One tap marks a sailor here; the coach never picks a status (late from the start time, excused
  from the RSVP; a long-press overrides). Tiles never move under the thumb. Everything works
  one-thumbed in polarized sunglasses. At start time each still-missing sailor is one tap from their
  guardian and one tap from their card.
- Attendance taps respond instantly; the emergency card opens in under 1 s on mobile data.
- Nothing secret in the repo or the client bundle. Schema changes only through versioned migrations.
  Every scheduled job is idempotent and catch-up-capable.
- WCAG 2.2 AA with outdoor-glare contrast; cyan buttons carry dark ink, never white.
- Monthly running cost stays at or under 40 USD.

## Working here

- Branch model: `develop` (integration) / `release` (production) / `main` (backup), all entered by
  pull request only. See the README.
- Real sailors' names and data never enter git, an issue, or a PR. Tests and fixtures use invented
  people.
- `npm run test:db` needs Docker. On a machine without it, CI is where that test runs.
- cairn (`../cairn`) is in this workspace for its skills, hooks and memory; start at its
  `memory/INDEX.md`.

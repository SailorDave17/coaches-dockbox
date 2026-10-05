# Coaches' Dockbox

One app for Hoover Sailing Club's three programs — COHSSA high school sailing, the Hoover Junior
Race Team (JRT) and Hoover Learn to Sail — replacing the pile of apps, sheets and paper that coaches,
sailors and families juggle today. The pilot is **JRT alone, spring 2027**.

**Status:** scaffold (2026-09-29). No feature has shipped. The charter is ratified; the stories come
next.

## What the pilot does

- **The dock moment**: as each sailor arrives, a coach marks them with one thumb in under 3 seconds
  without putting anything down; at start time the screen shows who is still missing, each one tap
  from their guardian's phone or emergency card. Late comes from the clock and excused from the RSVP,
  so the coach never picks a status.
- Schedule and RSVP, and alerts that reach every family by push **and** email.
- Team messages copy guardians automatically. There is no private coach-to-minor messaging (US Sailing
  SafeSport MAAPP).
- Parents keep their child's contacts, emergency contacts and medical flags current.
- A lesson-plan and resource library the club keeps when coaches move on.
- A towing schedule for the trailers going to regattas.

Later: coach pay (clock in, receipts, payroll-service export), practice video and each sailor's growth,
SMS, and the other two programs.

## What it will not do

- Payments and registration — they stay in Clubspot.
- Regatta scoring and results — Burgee's job.
- Payroll itself — Dockbox exports approved hours and receipts.
- Other clubs — Hoover Sailing Club only.

## Stack

| Decision | Choice | ADR |
|---|---|---|
| Backend | Supabase in its own organisation (Postgres + RLS, Auth, Edge Functions); Free now, Pro before the first real sailor's data | [001](docs/adr/001-backend-supabase.md) |
| Medical data | One Edge Function is the only path to medical flags; table closed to every client role | [002](docs/adr/002-medical-flags-path.md) |
| Hosting | Cloudflare Workers static assets | [003](docs/adr/003-hosting-cloudflare-workers.md) |
| Email | Resend: sign-in links as transactional mail, alerts as broadcasts | [004](docs/adr/004-email-resend-split.md) |
| App | React + TypeScript + Vite PWA | [005](docs/adr/005-app-shape-pwa.md), [007](docs/adr/007-frontend-react-vite.md) |
| Alerts | Web Push + email; SMS before Learn to Sail joins | [006](docs/adr/006-alerts-push-email.md) |
| Repo and deploys | develop / release / main; CI deploys on merge to `release` | [008](docs/adr/008-repo-branches-deploy.md) |
| Testing | The first test proves another program's coach is refused a medical card | [009](docs/adr/009-testing.md) |
| Monitoring | Sentry free + a scheduled health check | [010](docs/adr/010-observability.md) |
| Day-1 seams | Migrations, one data module, typed config, strict TS | [011](docs/adr/011-day-1-seams.md) |
| Roster | Clubspot API, CSV fallback from 2027-02-01 | [012](docs/adr/012-roster-clubspot.md) |

The full reasoning, including every option rejected, is in [`docs/charter.md`](docs/charter.md).

## Running it

```sh
npm install
cp .env.example .env.local   # then fill in the two public Supabase values
npm run dev
```

The app refuses to start without those two values, on purpose.

| Script | Does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Type-check and production build to `dist/` |
| `npm run lint` | oxlint; a warning fails |
| `npm run format:check` | Prettier |
| `npm run typecheck` | `tsc -b` |
| `npm run test:db` | The medical-access, seasons and club-time, roster-read, guardian-link and sign-in tests, the API-roles reach guard, the policy-functions catalog test, the heartbeat Edge Function through the gateway, admission through the admit function, and the bootstrap command, against a local Supabase |
| `npm run test:unit` | The glare token test: every colour token classified, every text-on-background pair the stylesheets declare held to the glare contrast. Also the sign-in decisions, with a fake auth client, local Auth's settings in `supabase/config.toml`, and the bootstrap command's refusals at start |
| `npm run test:screens` | Every screen through the accessibility helper, in Chromium against the built app. Run `npm run build` first |
| `npm run lint:functions` | `deno lint` over the Edge Functions in `supabase/functions/` |
| `npm run typecheck:functions` | `deno check` over the same, strict like the app |
| `npm run test:functions` | `deno test`: the functions' env loader fails at boot, naming each missing variable |
| `npm run bootstrap:program` | Creates a program, its first dated season and its director, with their account. Safe to repeat. See below |
| `npm run probe:build` | The throwaway device probe (#31), not the app: [`spikes/device-probe/`](spikes/device-probe/README.md) |

The Edge Functions are Deno, which `tsc -b` and Vitest do not cover. Deno comes from the
`deno` dev dependency, so the three `:functions` scripts need nothing installed beyond `npm install`.
Every function loads its env at module scope through `supabase/functions/_shared/env.ts` (ADR 011),
so a missing secret fails the function at boot, not at its first request. After editing a function,
restart the local edge runtime (`docker restart supabase_edge_runtime_coaches-dockbox`): it serves a
copy compiled at start, so an edit does not reach it until then. A new function is not served until
the whole stack restarts (`npx supabase stop`, then `start`), because the list of functions is fixed
when the stack starts; until then its URL answers the gateway's 404.

`test:db` needs a local Supabase (`npx supabase start`, which needs Docker) and its credentials
exported from `npx supabase status -o env`. CI runs it on every pull request, then runs Supabase's
security advisors against the same database, failing on any warning (#34). To prove the tests can
fail, run the CI workflow by hand with a `mutation`. With `medical-ignores-program` or
`anon-select-on-programs`, exactly one case should go red. With `medical-ignores-season-dates`,
exactly two: the coach whose season ended yesterday and the one whose season starts tomorrow.
With `roster-ignores-program`, exactly seven, all roster and guardian-link reads by a current coach or
director, the other-program cases among them. With `policy-calls-unlisted-definer`, exactly one: the
allow-list case. With `medical-any-guardian-passes`, exactly two: the unlinked guardian and another
sailor's guardian. With `guardian-read-ignores-unlink`, exactly one: the unlinked guardian's read.
With `me-ignores-caller`, exactly three: each sign-in case that reads its own name from `public.me`.
With `admit-anyone`, exactly one: the admission case for an email on no roster. It is a patch to the
admit function rather than SQL, so CI applies it before Supabase starts.
Each file names the cases it expects.
To prove a step fails where it fails, run it by hand with a `plant`:
`unreachable-registry` fails every pull, so the `Start Supabase` step tries three times and then
names each refused image. `broken-migration` fails on attempt 1 and is not retried.
`table-without-rls` adds a table with RLS off that signed-in clients can read: exactly one test goes
red, and the advisors step names the table and fails.

Every screen test calls `expectScreenClean(page)` from `tests/a11y/screen.ts` (#36). It fails on any
axe-core WCAG 2.2 A or AA violation, on any visible interactive element under 56 by 56 CSS px, and on
any text axe measured that misses the owner's glare contrast (D23): 7:1 on paper and pale
backgrounds, 4.5:1 on a brand-coloured control, and `--cyan` always carries `--ink`. `test:unit`
holds the same rule over the pairs the stylesheets declare, and refuses a new colour token until
`tests/a11y/glare.ts` says which bar it is held to. CI's checks job runs both, building with
placeholder public values. Locally, install the browser once with
`npx playwright install --only-shell chromium`. The helper's own controls are
`tests/screens/a11y-helper.spec.ts`: each fixture in `tests/a11y/fixtures/` plants one defect, and
the helper must report exactly that defect.

New tables and functions in `public` are granted to no API role, and new tables get RLS
(`supabase/migrations/20261001120000_deny_api_roles_by_default.sql`). A migration that creates one
grants what it needs, `service_role` included.

A membership belongs to a dated season of its program, and medical access lasts only while that
season is current in club time: `public.club_today()`, the date in America/New_York
(`supabase/migrations/20261001140000_seasons_with_dates.sql`, #39).

A signed-in coach or director reads the people, memberships, seasons and programs of each program
in which they coach or direct a current season, limited to its current seasons. No one else reads
them except a guardian (below) and each person's own row (sign-in, below), and no client writes them or reads `people.auth_user_id`, so a client
names its columns rather than selecting `*` (`supabase/migrations/20261001160000_roster_reads.sql`,
#43). The policies call one security-definer helper, `private.my_roster_season_ids()`. That is
allowed under ADR 001's kill condition as amended by D3, and `tests/db/policy-functions.test.ts`
keeps the list of functions any policy may call.

A guardian is linked to each of their children by a `guardian_links` row, many to many, and an unlink
keeps the row with `unlinked_at` set. A signed-in guardian reads the `people` rows of the sailors they
are currently linked to and no one else but themselves, and `can_view_medical` lets them through for those sailors
in any season. At most one current link per sailor is primary. A coach or director reads the current
links of the sailors on their roster, never `unlinked_at`, and no client writes a link
(`supabase/migrations/20261001180000_guardian_links.sql`, #53). The people policy calls a second
definer helper, `private.my_linked_sailor_ids()`.

Sign-in is by emailed link (#52). Sign-ups are off (D15), so the app asks for a link with
`shouldCreateUser: false`, and the screen says "Check your email" whatever address was entered: an
address with no account is refused by the server, and saying so would tell anyone which addresses
have one. Every signed-in person reads their own `people` row, and `public.me`, an invoker view,
returns that row and nothing else, which is how the app says "Signed in as" a first name or "You're
not on a Dockbox roster yet" (`supabase/migrations/20261001200000_read_own_person.sql`, through a
third helper, `private.my_person_id()`). Sign out ends this device's session only, and runs the
sign-out hooks first (`onSignOut` in `src/auth/session.ts`), which is where the card cache wipes.

An account exists only when server code admits a person (#59). A `people` row carries the email the
roster sync or a director wrote, stored lower-case and unique, and readable by no client. The `admit`
Edge Function, called with the service-role key, creates a confirmed account for that email and sets
the row's `auth_user_id` itself: `POST /functions/v1/admit` with `{ "email": "…" }`. It answers 404 and
creates nothing for an email no row carries, is safe to repeat or run twice at once, and never reads
`user_metadata`, which a user can rewrite. No client may write `auth_user_id`. The shared code is
`supabase/functions/_shared/admission.ts`, for the roster sync to import.

A program's first director is created by one command (#63), since nothing else can make them with
sign-ups off:

```sh
npm run bootstrap:program -- --program "<name>" --season "<name>" --starts YYYY-MM-DD \
  --ends YYYY-MM-DD --first <first name> --last <last name> --email <address>
```

It needs `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the environment, never in a file, and
stops before any request without them. The key is the legacy service-role JWT (`SERVICE_ROLE_KEY` in
`npx supabase status -o env`), because the admit function accepts no other. It creates whatever is
missing of the program, the season, the director's `people` row, their account (through `admit`) and
a director membership of the season, and prints the four ids and nothing else. Run again with the
same arguments, it changes nothing; after a run that stopped part-way, it finishes the job. An
existing season of that name with other dates, or an existing person with that email under another
name, stops it before it writes anything.

To sign in locally, start the local Supabase, put its `API_URL` and `ANON_KEY` in `.env.local`, and
run `npm run dev`, which serves on `http://localhost:5173`, the one origin local Auth sends links back
to. A person needs a `people` row with an email, then admission: insert the row with the service-role
key and `POST` its email to `$FUNCTIONS_URL/admit` with the same key. The emailed link lands in the
local mailbox (`INBUCKET_URL` in `npx supabase status`). Admin `generateLink` makes one without
sending mail.

## Branches

| Branch | What it is | How it is entered |
|---|---|---|
| `develop` | Integration, and the default. Branch from here. | A pull request, merged by the owner |
| `release` | **Production.** A merge deploys. | A pull request from `develop`, merged by the owner |
| `main` | The backup: a known-good copy of what production ran | A pull request from `release`, merged by the owner |

`githooks/pre-push` refuses direct pushes to all three. Enable it once per clone:
`git config core.hooksPath githooks`.

GitHub refuses them too, whatever the client. A repository ruleset requires a pull request and
both CI checks on all three branches, and nobody can bypass it (#28). It is enforced only while
the repository is public (#25).

## Privacy

This app holds minors' contact details and medical flags. The control that matters is structural:
the medical table is closed to every client role, and one server function is the only path to it,
logging every view. Nothing secret lives in this repo or in the browser bundle. Placeholder data only
in tests and fixtures — never a real sailor.

# Coach's Dockbox

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
| `npm run test:db` | The medical-access test against a local Supabase |

`test:db` needs a local Supabase (`npx supabase start`, which needs Docker) and its credentials
exported from `npx supabase status -o env`. CI runs it on every pull request. To prove it can fail,
run the CI workflow by hand with `mutation: medical-ignores-program`: exactly one case should go red.
To prove the `Start Supabase` step fails where it fails, run it by hand with a `plant`:
`unreachable-registry` fails every pull, so the step tries three times and then names each refused
image. `broken-migration` fails on attempt 1 and is not retried.

## Branches

| Branch | What it is | How it is entered |
|---|---|---|
| `develop` | Integration, and the default. Branch from here. | A pull request, merged by the owner |
| `release` | **Production.** A merge deploys. | A pull request from `develop`, merged by the owner |
| `main` | The backup: a known-good copy of what production ran | A pull request from `release`, merged by the owner |

`githooks/pre-push` refuses direct pushes to all three. Enable it once per clone:
`git config core.hooksPath githooks`.

## Privacy

This app holds minors' contact details and medical flags. The control that matters is structural:
the medical table is closed to every client role, and one server function is the only path to it,
logging every view. Nothing secret lives in this repo or in the browser bundle. Placeholder data only
in tests and fixtures — never a real sailor.

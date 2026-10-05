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
  *(Read precisely by D3: see "Amended 2026-10-01" below for which definer helpers are not the
  escape.)*
- **Amended 2026-09-29 (owner): Free until real data, then Pro.** Backups and no idle pause protect
  data, and until a real sailor's record exists there is none. So the organisation starts on the Free
  plan, in an owner account that still has a free project slot (the main account's two hold Tender and
  Taskr). The target is unchanged. Pro is a plan on the organisation, so the move is an in-place
  upgrade: same project, URL, keys and data, with no migration.
  - **Created 2026-09-29**: organisation "Coaches' Dockbox" (Free), project `coaches-dockbox`, ref
    `oygkxgfjbrvddofifrpk`, East US (North Virginia). No GitHub integration, since an active one
    blocks transferring the project to HSC. Security options left at their defaults (Data API on,
    new tables exposed, no automatic-RLS trigger) because the local stack the medical test runs on
    uses the same defaults and the init migration relies on them. Change both sides together or
    neither. Empty until the first release deploy applies the migrations (ADR 008). *(Superseded
    2026-09-30 by D69, below: Supabase changes the hosted default on 2026-10-30 whatever this
    project does, so "neither" stopped being available. Both sides now move together, by migration.)*
  - **Upgrade trigger**: before the first real sailor's record is written (the first roster import),
    and before the restore rehearsal, which needs Pro anyway. Until then the $25 is $0.
  - **Until then**: the project pauses after 7 idle days; restore it from the dashboard. There are no
    backups, so nothing real may be written to it.
  - **While on Free, invite other logins as Developer, not Owner or Administrator**: the free
    two-project limit counts every organisation where a login holds those roles, so an Owner invite
    counts this project against that login's two (`supabase-org-billing-and-firebase-as-alternative`).
- **Reopened 2026-09-30 (owner): a Java + Spring Boot backend was weighed for security. Supabase
  stays, hardened to deny by default now; a Spring API in front of it is the named next move**
  (D68 to D71 in `docs/backlog-decisions-2026-09-30.md`).
  - **The question**: would Spring Boot make the app more secure? Of the charter's seven threats it
    changes one structurally. Supabase's Data API exposes every granted table to anyone holding the
    public key, so one table created without RLS is exposed. The other six are stack-neutral or
    favour RLS. RLS refuses a query nobody wrote a check for. Spring's method security leaves a
    method nobody annotated open: its reference says "unannotated methods are not secured"
    (*measured*), and annotation detection in that approach had three authorization-bypass CVEs in
    2025, one of them CRITICAL: CVE-2025-41232, -41248 and -41249 (*measured*, spring.io/security
    and the GitHub Advisory Database).
  - **Options priced** (*measured* 2026-09-30 from vendor pricing pages and release records). The
    engineer-days are *reasoned* and ungroomed, measured against 150.5 days before go-live at D39's
    5 a week. The last ungroomed estimate here, boat repairs, came in about 2.9 times low:

    | Option | Running cost / month | Days before go-live | Go-live |
    |---|---|---|---|
    | **Supabase, hardened** (chosen) | ~$26 at Pro | ~1, inside #34 | 2027-04-28, a day or so later at most |
    | Hybrid: Spring API in front of Supabase Postgres + Auth, Data API off | $31.70–32 (Pro + a 1 GB always-on host) | +18.25 | ~2027-05-24 |
    | Full Spring: Spring Boot + Spring Security + managed Postgres | $22–26 ($26.15 for the managed pair, DigitalOcean App Platform + Managed Postgres) | +26 | ~2027-06-03 |

  - **Decision**: keep Supabase and harden it now (D68, D69). The hybrid is the next move. It adds a
    layer without replacing one, since the schema, policies, Auth and backups stay. So deferring it
    discards nothing.
  - **Rejected**:
    - *Full Spring now*. About five weeks of platform work no family sees, moving go-live past the
      spring season the pilot exists to measure. Sign-in that Supabase Auth gives today would be
      rebuilt by hand: the token store, the email, rate limiting and CSRF. Spring Security's
      one-time-token login has no rate limiting (*measured*). Java-only authorization would also
      undo answer 4.2, access enforced in the database, the property Cloudflare D1 was rejected
      for. And a
      solo operator would upgrade Spring about every six months: Boot 4.1's open-source support
      ends 2027-07-31, and older lines are patched only under paid support (*measured*).
    - *Hybrid now*. The same exposure gain for +18.25 days and about +$6/month, landing late in
      the season.
    - *Waiting for Supabase's own default change* (D69).
  - **What the hardening does** (D69; lands in #34, amended):
    - **The default change.** Supabase stops granting new `public` tables and functions to `anon`,
      `authenticated` and `service_role` on **2026-10-30, for all existing projects** (*measured*,
      github.com/orgs/supabase/discussions/45329). The local CLI keeps the old grants until it is
      upgraded. The lockfile's npm `supabase@2.118.0` treats an unset `auto_expose_new_tables` as
      "keep the grants" (*measured*, its `db-setup.ts`), and CI run 36808569679's service-role
      inserts succeeded. Left alone, hosted and local diverge on that date.
    - **The opt-in, by migration, so both sides match by construction**:
      - Supabase's own `alter default privileges … revoke` lines;
      - explicit grants in each table's own migration, `service_role` included, so the test setup
        survives the CLI upgrade;
      - an event trigger that enables RLS on every new table;
      - `auto_expose_new_tables = false` in `supabase/config.toml`;
      - `supabase db advisors --local --type security --fail-on warn` in CI, beside #34's catalog
        test. Its default `--fail-on none` never fails a build (*measured*).
    - **The effect.** Exposing a table now takes two deliberate acts, an explicit grant and a
      missing or permissive policy, where before it took one omission.
    - **As landed in #34 (2026-10-01)**, in `20261001120000_deny_api_roles_by_default.sql`. Three
      points differ from the plan above, each *measured* on the local stack with CLI 2.118:
      - Supabase's own lines are not enough. They revoke select, insert, update and delete. With
        `auto_expose_new_tables = false`, which runs them, anon still held TRUNCATE, REFERENCES,
        TRIGGER and MAINTAIN on every new table, and UPDATE on every new sequence. The migration
        revokes all.
      - Postgres's own EXECUTE to PUBLIC on new functions needs a revoke with no schema, which
        covers every function `postgres` creates. Supabase's notice does not revoke it.
      - The RLS trigger is `security invoker`, not the guide's `security definer`, because the
        creator of a table owns it.
    - **What the advisors miss.** CLI 2.118's embedded lints do not flag a security-definer function
      that anon may execute (granting anon EXECUTE on `can_view_medical` reported "No issues
      found"). The catalog test catches it. An RLS-off table is flagged only when anon or
      authenticated can read it; one granted to `service_role` alone reports nothing.
    - **What it does not fix, and Spring would not either**: a wrong policy, a bug in
      `can_view_medical`, a leaked service-role or secret key, and an attack on sign-in itself.
    - **One placement to settle with the medical function (#61).** `public.can_view_medical` is a
      security-definer function in an exposed schema, and Supabase's RLS guide says such functions
      "should never be created" there (*measured*). #61 either moves it out of `public` or exempts
      it with the reason.
  - **The next move, decided now so it is not re-asked**:
    - *Its shape*. A Spring Boot API in front of this project, with the Data API switched off. Spring
      validates Supabase's tokens against `https://<ref>.supabase.co/auth/v1/.well-known/jwks.json`.
      That needs `jws-algorithms: ES256`, because Spring defaults to RS256, plus the issuer and the
      `authenticated` audience pinned (*measured*, both vendors' docs).
    - *Access control: Spring checks, and RLS still decides* (D70). Each transaction sets the role
      and the caller's JWT claims with `SET LOCAL`. The app never connects as a table owner. Every
      policy treats an empty claim as no user, since after a commit the setting reads as an empty
      string, not NULL (*measured*, PostgREST and Postgres docs). Answer 4.2 and ADR 009's
      refusal test keep their meaning.
    - *Where it lives: a monorepo `api/` folder on a managed always-on host* (D71). There is no OS
      to patch. A Fly.io 1 GB machine costs about $5.70 a month (*measured* rate). This answers
      ADR 008's "second deployable" kill condition with a folder rather than a second repo.
    - *Trigger*: any one of the following.
      - `security-audit` (#126) or the second reviewer (#127) reaches a table through the Data API
        that the hardening should have refused.
      - Supabase retires the anon and service-role keys, which it has scheduled for "late 2026, TBC"
        (*measured*, supabase.com/blog/jwt-signing-keys, 2025-07-14), in a way that changes what a
        browser may hold.
      - Failing both, the post-pilot review re-decides it on the pilot's own evidence.
- **Amended 2026-10-01 (D3, with #43): the kill condition, read precisely.** It lands before the first
  policy migration (`20261001160000_roster_reads.sql`). A security-definer helper that an RLS policy
  calls is not the escape the kill condition names when all four of these hold:
  - it returns only the caller's own facts;
  - it is `stable`, with `search_path=''`;
  - execute on it is revoked from `public` and `anon`;
  - it is tested: a catalog test reads `pg_depend` and `pg_proc.prosecdef`, and fails when a policy
    calls a function missing from its allow-list, or a definer one that breaks the three conditions
    above.

  A definer function that returns protected rows, or a definer RPC that is the only guard on a read
  or a write, **still fires the kill condition.**
  - **Why a definer is needed at all.** The memberships policy has to ask which seasons the caller
    coaches, and that is a read of memberships. Run as the caller, the read re-enters memberships'
    own policy, and Postgres refuses that as infinite recursion. As the tables' owner, the helper
    reads past the policy.
  - **As landed in #43**: one helper, `private.my_roster_season_ids()`. It returns the ids of the
    current seasons of each program in which the caller coaches or directs a current season, and
    nothing else. It lives in `private`, a schema the Data API does not serve, so the four roster
    policies reach it by OID with only EXECUTE. A signed-in client that calls it by name is refused
    with `permission denied for schema private` (*measured* on the local stack, 2026-10-01).
    `tests/db/policy-functions.test.ts` holds the allow-list.
  - `public.can_view_medical` is called by no policy, so the allow-list does not cover it. Its
    placement stays with #61, as recorded above.

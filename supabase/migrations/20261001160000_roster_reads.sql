-- Scope roster reads to the caller's current-season programs (#43, E3, D3, D46).
--
-- Until now no client could read people, memberships, seasons or programs: each had RLS on and no
-- policy, and since #34 nothing was granted. From this file a signed-in coach or director reads the
-- people, memberships, seasons and programs of each program in which they coach or direct a season
-- that is current in club time, and only that program's current seasons. Nobody else reads any of
-- it, a sailor or a treasurer included (D46), and no client writes any of it.
-- tests/db/roster-reads.test.ts and tests/db/policy-functions.test.ts fail when any of it stops
-- holding.

-- 1. The one function the policies call. ADR 001's kill condition, as amended by D3 (2026-10-01): a
-- security-definer helper called from a policy is allowed when it returns only the caller's own
-- facts, is stable with search_path='', has execute revoked from public and anon, and is tested.
--
-- Definer, because the memberships policy has to ask which seasons the caller coaches, and that is a
-- read of memberships. As invoker, the read would re-enter memberships' own policy, which Postgres
-- refuses as infinite recursion, and it would need people.auth_user_id, which no client may read
-- (section 2). As the tables' owner it reads past both.
--
-- It returns the caller's own scope and nothing more: the ids of the current seasons of each program
-- in which the caller coaches or directs a current season. No name and no row.
--
-- It lives in `private`, a schema the Data API does not serve, so no client can call it by name. A
-- policy stores the function's OID rather than its name, so a caller needs EXECUTE on it and no
-- USAGE on the schema.
create schema private;
revoke all on schema private from public;

create function private.my_roster_season_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select roster.id
  from public.people viewer
  join public.memberships vm
    on vm.person_id = viewer.id
   and vm.role in ('coach', 'director')
  join public.seasons own
    on own.id = vm.season_id
   and public.club_today() between own.starts_on and own.ends_on
  -- The program predicate: every current season of the program the caller's own season belongs to.
  join public.seasons roster
    on roster.program_id = own.program_id
   and public.club_today() between roster.starts_on and roster.ends_on
  where viewer.auth_user_id = (select auth.uid());
$$;

-- The deny-by-default privileges (20261001120000) already leave it executable by its owner only.
-- Revoked by name anyway, so this file still holds if those defaults ever change.
revoke all on function private.my_roster_season_ids() from public, anon, authenticated, service_role;
grant execute on function private.my_roster_season_ids() to authenticated;

-- 2. What a signed-in client may read, column by column, and nothing it may write. Column grants
-- rather than table grants, so a column a later migration adds stays withheld until a grant names
-- it. people.auth_user_id is withheld: it links a person to a sign-in account, and no client reads or
-- writes it. Because it is withheld, `select *` on people is refused, so a client names its columns.
grant select (id, first_name, last_name) on table public.people to authenticated;
grant select (person_id, program_id, role, season_id) on table public.memberships to authenticated;
grant select (id, program_id, name, starts_on, ends_on) on table public.seasons to authenticated;
grant select (id, name) on table public.programs to authenticated;

-- 3. Which rows. The scope is decided once, by the helper, in the memberships and seasons policies.
create policy memberships_read_roster on public.memberships
  for select to authenticated
  using (season_id in (select private.my_roster_season_ids()));

create policy seasons_read_roster on public.seasons
  for select to authenticated
  using (id in (select private.my_roster_season_ids()));

-- A person is visible while one of their memberships is. The subquery runs as the caller, so
-- memberships_read_roster filters it, and this policy needs no scope of its own. A second copy of
-- the season check here could never fail a test while the first one held.
create policy people_read_roster on public.people
  for select to authenticated
  using (exists (select 1 from public.memberships m where m.person_id = people.id));

-- A program is visible while one of its seasons is, through seasons_read_roster in the same way.
create policy programs_read_roster on public.programs
  for select to authenticated
  using (exists (select 1 from public.seasons s where s.program_id = programs.id));

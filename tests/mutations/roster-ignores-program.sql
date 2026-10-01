-- prove-tests mutation for #43. Applied in CI only on a hand-run of the workflow with
-- `mutation: roster-ignores-program`, after the migrations and before the tests.
--
-- It drops the program predicate from private.my_roster_season_ids(), so a caller who coaches or
-- directs any current season reads every program's current seasons, and through them every
-- program's current people. The caller's own role and season dates still count.
-- Predicted: exactly seven red. Five are in roster-reads.test.ts:
-- - "lets an LTS coach read LTS's current members and none of JRT's", the other-program case;
-- - "lets a JRT coach read JRT's current members and no one else";
-- - "lets a JRT director read the same as a JRT coach (D46)";
-- - "reads a JRT coach's memberships without RLS recursion, current seasons only";
-- - "lets a JRT coach read JRT's current seasons and its program, and no other".
-- Two are in guardian-links.test.ts (#53), whose coaches read links through memberships' policy:
-- - "lets a JRT coach read the current links of JRT's sailors, and not an unlinked one or LTS's";
-- - "lets an LTS coach read LTS's links and none of JRT's".
-- Last season's coach, the sailor and the treasurer still read no one: they hold no current coach
-- or director membership. Guardians read through their own helper, not this one. The grant and
-- catalog cases, the medical test and the seasons test do not read through the policies. Any other
-- result means the tests are not measuring what they name.
create or replace function private.my_roster_season_ids()
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
  join public.seasons roster
    on public.club_today() between roster.starts_on and roster.ends_on
  where viewer.auth_user_id = (select auth.uid());
$$;

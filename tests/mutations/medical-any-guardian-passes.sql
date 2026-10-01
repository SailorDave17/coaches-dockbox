-- prove-tests mutation for #53. Applied in CI only on a hand-run of the workflow with
-- `mutation: medical-any-guardian-passes`, after the migrations and before the tests.
--
-- It drops both conditions on the guardian's link from can_view_medical, the link being current and
-- the link being to this sailor, so anyone who is or was any sailor's guardian passes for every
-- sailor. The coach clause is unchanged.
-- Predicted: exactly two red, both in medical-access.test.ts: "refuses a guardian whose link to the
-- sailor was unlinked" and "refuses another sailor's guardian". The current guardian still passes,
-- the coach cases do not use the guardian clause, and guardian-links.test.ts does not call the
-- function. Any other result means the test is not measuring what it names.
create or replace function public.can_view_medical(p_sailor uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.people viewer
    join public.memberships vm
      on vm.person_id = viewer.id
     and vm.role in ('coach', 'director')
    join public.seasons s
      on s.id = vm.season_id
     and public.club_today() between s.starts_on and s.ends_on
    join public.memberships sm
      on sm.season_id = vm.season_id
     and sm.role = 'sailor'
    where viewer.auth_user_id = auth.uid()
      and sm.person_id = p_sailor
  )
  or exists (
    select 1
    from public.people viewer
    join public.guardian_links gl
      on gl.guardian_id = viewer.id
    where viewer.auth_user_id = auth.uid()
  );
$$;

-- prove-tests mutation for #39. Applied in CI only on a hand-run of the workflow with
-- `mutation: medical-ignores-season-dates`, after the migrations and before the tests.
--
-- It drops the current-season check from can_view_medical, so a coach keeps access for as long as
-- their membership row stands, which is how it behaved before #39. The shared-season join stays.
-- Predicted: exactly two red, "refuses a coach whose only season ended yesterday in club time" and
-- "refuses a coach whose only season starts tomorrow in club time". The other-program coach is
-- still refused (their season is another program's), the right coach and the one-day season still
-- pass, and the table-revoke case does not use the function.
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
    join public.memberships sm
      on sm.season_id = vm.season_id
     and sm.role = 'sailor'
    where viewer.auth_user_id = auth.uid()
      and sm.person_id = p_sailor
  );
$$;

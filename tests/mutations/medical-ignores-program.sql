-- prove-tests mutation for ADR 009. Applied in CI only on a hand-run of the workflow with
-- `mutation: medical-ignores-program`, after the migrations and before the tests.
--
-- It drops the same-program condition from can_view_medical, so any coach passes.
-- Predicted: exactly one red, "refuses a coach of another program". The positive control stays
-- green (the right coach still passes) and the table-revoke case stays green (it does not use
-- the function). Any other result means the test is not measuring what it names.
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
      on sm.season = vm.season
     and sm.role = 'sailor'
    where viewer.auth_user_id = auth.uid()
      and sm.person_id = p_sailor
  );
$$;

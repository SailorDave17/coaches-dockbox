-- prove-tests mutation for ADR 009. Applied in CI only on a hand-run of the workflow with
-- `mutation: medical-ignores-program`, after the migrations and before the tests.
--
-- It drops the link between the coach's membership and the sailor's from can_view_medical, so any
-- coach in a current season passes for any sailor. Since #39 that link is the shared season, and a
-- season belongs to one program, so dropping only a program condition would change nothing: the
-- season join carries the program. The current-season check stays.
-- Predicted: exactly one red, "refuses a coach of another program". The positive control stays
-- green (the right coach still passes), the table-revoke case stays green (it does not use the
-- function), and the lapsed and not-yet-started coaches are still refused by their seasons' dates.
-- The guardian clause (#53) is carried unchanged, and no guardian holds a coach's membership, so the
-- guardian cases stay green too.
-- Any other result means the test is not measuring what it names.
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
      on sm.role = 'sailor'
    where viewer.auth_user_id = auth.uid()
      and sm.person_id = p_sailor
  )
  or exists (
    select 1
    from public.people viewer
    join public.guardian_links gl
      on gl.guardian_id = viewer.id
     and gl.unlinked_at is null
    where viewer.auth_user_id = auth.uid()
      and gl.sailor_id = p_sailor
  );
$$;

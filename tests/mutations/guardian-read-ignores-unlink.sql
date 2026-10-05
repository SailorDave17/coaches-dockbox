-- prove-tests mutation for #53. Applied in CI only on a hand-run of the workflow with
-- `mutation: guardian-read-ignores-unlink`, after the migrations and before the tests.
--
-- It drops the current-link condition from private.my_linked_sailor_ids(), so a guardian keeps reading
-- a sailor's people row after their link is unlinked. The guardian match stays.
-- Predicted: exactly one red, "lets a guardian whose link was unlinked read no one but themselves" in
-- guardian-links.test.ts. The current guardians read the same children as before, the coaches' link
-- reads go through their own policy, and can_view_medical does not call this function. Any other
-- result means the test is not measuring what it names.
create or replace function private.my_linked_sailor_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select gl.sailor_id
  from public.people viewer
  join public.guardian_links gl
    on gl.guardian_id = viewer.id
  where viewer.auth_user_id = (select auth.uid());
$$;

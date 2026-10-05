-- Let a signed-in person read their own people row, and tell which row is theirs (#52, E2, D3).
--
-- The app shows "Signed in as <first name>", or "You're not on a Dockbox roster yet" when the session
-- is linked to no person. Until now a person could read their own row only as part of a roster they
-- coach (#43), so a guardian, last season's coach, a sailor and a treasurer could not read it at all,
-- and no caller could tell which of the rows they read was their own: people.auth_user_id is
-- withheld from every client. From this file every signed-in person reads their own row, and
-- public.me returns it and nothing else.
-- tests/db/sign-in.test.ts and tests/db/policy-functions.test.ts fail when any of it stops holding.

-- 1. The one function the new policy and the view call. A definer for the same reasons as
-- private.my_linked_sailor_ids() (#53): it reads the caller's own people.auth_user_id, which no client
-- may select. It returns only the caller's own fact, the id of the person their session is linked to,
-- which D3 allows. auth_user_id is unique, so there is at most one. It lives in `private`, which the
-- Data API does not serve, so no client can call it by name.
create function private.my_person_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select viewer.id
  from public.people viewer
  where viewer.auth_user_id = (select auth.uid());
$$;

-- The deny-by-default privileges already leave it executable by its owner only. Revoked by name
-- anyway, so this file still holds if those defaults ever change.
revoke all on function private.my_person_id() from public, anon, authenticated, service_role;
grant execute on function private.my_person_id() to authenticated;

-- 2. A signed-in person reads their own people row: the columns #43 granted (id and names), no more.
-- Policies are permissive, so this adds to the roster and linked-sailor reads and narrows neither.
create policy people_read_self on public.people
  for select to authenticated
  using (id = (select private.my_person_id()));

-- 3. Which row is theirs. An invoker view, so the people policies above decide what it can return
-- and the caller needs the column grants #43 made; its filter only picks the caller's own row out of
-- what they may read. A definer view would be a second guard on people, and the one Supabase's
-- advisors refuse (security_definer_view). Like a policy, a view stores the function's OID, so a
-- caller needs EXECUTE on it and no USAGE on `private`.
create view public.me
with (security_invoker = true)
as
  select p.id, p.first_name
  from public.people p
  where p.id = (select private.my_person_id());

revoke all on table public.me from public, anon, authenticated, service_role;
grant select on table public.me to authenticated;

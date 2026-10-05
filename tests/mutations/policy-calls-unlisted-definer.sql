-- prove-tests mutation for #43 (ADR 001 as amended by D3). Applied in CI only on a hand-run of the
-- workflow with `mutation: policy-calls-unlisted-definer`, after the migrations and before the tests.
--
-- It adds a security-definer helper that meets every one of D3's conditions but is on nobody's
-- allow-list, and a policy that calls it. The helper answers false, so the policy admits no row and
-- no read changes.
-- Predicted: exactly one red, "calls exactly the functions on the allow-list" in
-- policy-functions.test.ts. The definer-conditions case stays green, because the helper meets them
-- all, so it is the allow-list alone that refuses an unlisted helper. Every roster read stays green.
create function private.unlisted_helper()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select false;
$$;

revoke all on function private.unlisted_helper() from public, anon, authenticated, service_role;
grant execute on function private.unlisted_helper() to authenticated;

create policy programs_read_unlisted on public.programs
  for select to authenticated
  using (private.unlisted_helper());

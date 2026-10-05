-- prove-tests mutation for #52. Applied in CI only on a hand-run of the workflow with
-- `mutation: me-ignores-caller`, after the migrations and before the tests.
--
-- It drops the caller filter from public.me, so the view returns every people row the caller may
-- read instead of their own. The people policies, the self-read included, are unchanged.
-- Predicted: exactly three red, all in sign-in.test.ts:
-- - "gives a pre-created coach a magic-link session that reads their own first name from public.me";
-- - "returns only the caller from public.me, though the coach reads their roster";
-- - "lets a guardian, who holds no membership, read their own row beside their child".
-- The coach reads their sailor and the guardian their child, so each gets two rows. The session
-- linked to no person reads no row either way, so its case stays green, and no other file reads
-- public.me. Any other result means the tests are not measuring what they name.
create or replace view public.me
with (security_invoker = true)
as
  select p.id, p.first_name
  from public.people p;

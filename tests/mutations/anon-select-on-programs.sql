-- prove-tests mutation for #34. Applied in CI only on a hand-run of the workflow with
-- `mutation: anon-select-on-programs`, after the migrations and before the tests.
--
-- It hands anon back one privilege on one table, the shape of a later migration that grants a
-- table to anon by mistake. Predicted: exactly one red, "gives anon no privilege on any table or
-- view in public". Its positive control stays green (service_role is untouched), and so do the
-- function, new-object and RLS cases and the medical test. The advisors step stays green too:
-- programs keeps RLS on, which leaves only the INFO-level lint "RLS enabled, no policy".
grant select on public.programs to anon;

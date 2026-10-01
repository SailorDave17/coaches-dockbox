-- prove-tests plant for #34's CI advisors step and the catalog test's RLS case. Copied into
-- supabase/migrations only on a hand-run of the workflow with `plant: table-without-rls`. It is
-- never committed there.
--
-- A table in public with RLS switched off, granted to signed-in clients: the exposure the
-- advisors exist to catch. The grant is needed. The advisors' `rls_disabled_in_public` lint
-- (ERROR) fires only when anon or authenticated hold a privilege on the table. Measured locally,
-- an RLS-off table granted to service_role alone reports "No issues found".
--
-- The event trigger from 20261001120000 enables RLS when the table is created, so the plant has
-- to switch it off again, as a later migration doing it by mistake would.
--
-- Predicted: the Start step stays green. In `npm run test:db`, exactly one red: "finds no table
-- with RLS off in a schema supabase/config.toml exposes". The anon case stays green, since the
-- grant is to authenticated. The advisors step reports exactly one issue, this table, and fails.
create table public.planted_without_rls (id int);
alter table public.planted_without_rls disable row level security;
grant select on public.planted_without_rls to authenticated;

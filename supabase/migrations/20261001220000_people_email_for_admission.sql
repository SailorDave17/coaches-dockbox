-- The email a person is admitted by (#59, E2, D15).
--
-- Sign-ups are off, so an account exists only when server code admits a person: the admit Edge
-- Function reads this column, creates a confirmed auth user for it and sets people.auth_user_id. The
-- roster sync and a director write it; no client reads or writes it.
-- tests/db/admission.test.ts fails when any of it stops holding.

-- 1. One email per person, stored the way Supabase Auth compares it. Auth holds one account per
-- email whatever its case, and auth_user_id is unique, so two people sharing an address could never
-- both be admitted. The constraint says so where the roster is written, rather than leaving the admit
-- function to pick one of them.
alter table public.people add column email text;

alter table public.people
  add constraint people_email_normalised check (email = lower(btrim(email)));

alter table public.people add constraint people_email_key unique (email);

-- 2. No grant. authenticated holds select on (id, first_name, last_name) only (#43), and nothing
-- else on this table, so the new column is unreadable and every column unwritable by a client.
-- service_role's table-wide grant (20261001120000) covers it for the server.

-- Deny the Data API roles by default (#34, D69, ADR 001 reopened 2026-09-30).
--
-- On 2026-10-30 Supabase stops granting new public tables to anon, authenticated and service_role
-- in every existing project, and a local CLI keeps the old grants until it is upgraded. This file
-- opts in now, on both sides, so hosted and local reach the same state whatever the platform did
-- before it ran. Exposing a table then takes two deliberate acts, an explicit grant and a missing
-- or permissive policy, where before it took one omission. tests/db/api-roles-reach.test.ts reads
-- the catalog and fails when any of this stops holding.

-- 1. Nothing postgres creates in public from here on is granted to an API role. Each later
-- migration grants what its own objects need, service_role included.
--
-- `revoke all`, not Supabase's published opt-in. Those lines revoke select, insert, update and
-- delete only. Measured on CLI 2.118 with `auto_expose_new_tables = false`, which runs them before
-- the migrations: anon still held TRUNCATE, REFERENCES, TRIGGER and MAINTAIN on every new table,
-- and UPDATE on every new sequence.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke all on functions from anon, authenticated, service_role;

-- Postgres itself grants EXECUTE on every new function to PUBLIC, which anon inherits. That default
-- is global, and a line scoped to a schema cannot remove it (Postgres, ALTER DEFAULT PRIVILEGES).
-- So this line has no schema: it covers every function postgres creates, in any schema. A function
-- a client calls, or an RLS policy calls on a client's behalf, needs its own grant.
alter default privileges for role postgres
  revoke execute on functions from public;

-- 2. The tables and function that already exist. Their grants came from whichever defaults were in
-- force when 20260929200000 ran, which differ between hosted and local, so they are reset here and
-- granted explicitly. service_role keeps the four verbs the server side uses: the medical test's
-- setup inserts as service_role, and survives the CLI upgrade only because of these lines.
revoke all on table public.programs, public.people, public.memberships, public.medical_flags
  from anon, authenticated, service_role;
grant select, insert, update, delete
  on table public.programs, public.people, public.memberships, public.medical_flags
  to service_role;

revoke all on function public.can_view_medical(uuid) from public, anon, authenticated, service_role;
grant execute on function public.can_view_medical(uuid) to authenticated;

-- 3. Every table created in public from here on has RLS enabled, whether a migration or plain SQL
-- creates it. This is Supabase's own trigger from its event-triggers guide. Its function and
-- trigger names are kept, so running the guide's SQL later replaces this rather than adding a
-- second trigger. Two changes: it is `security invoker`, and the function is schema-qualified.
-- Supabase's is `security definer`, and its own RLS guide says never to create one in an exposed
-- schema. Definer gains nothing here, because whoever creates a table owns it and may enable RLS
-- on it.
--
-- It enforces public only, as Supabase's does: the other schemas belong to the platform. The
-- catalog test checks every schema in config.toml's [api] schemas, so a table in another exposed
-- schema with RLS off still fails the suite.
create function public.rls_auto_enable()
returns event_trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  cmd record;
begin
  for cmd in
    select *
    from pg_event_trigger_ddl_commands()
    where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      and object_type in ('table', 'partitioned table')
  loop
    if cmd.schema_name = 'public' then
      begin
        execute format('alter table if exists %s enable row level security', cmd.object_identity);
        raise log 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      exception
        when others then
          raise log 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
          -- Re-raised, so the create fails rather than leaving a table without RLS.
          raise;
      end;
    end if;
  end loop;
end;
$$;

create event trigger ensure_rls
  on ddl_command_end
  when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  execute function public.rls_auto_enable();

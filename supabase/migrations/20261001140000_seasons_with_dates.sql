-- Give seasons real dates so access ends with the season (#39, E3).
--
-- Until now a membership named its season as free text, so nothing could say when a season ended,
-- and a coach kept medical access for as long as their row stood (charter threat: "a former coach
-- with lingering access"). From this file a season is a dated row of one program, every membership
-- points at one, and can_view_medical admits a coach only while that season is current in club
-- time. tests/db/seasons.test.ts and tests/db/medical-access.test.ts fail when any of it stops
-- holding.

-- 1. Club time. A season's dates are the club's dates, so "today" is the date in America/New_York,
-- never the server's or the session's, which are both UTC on Supabase. The zone is named rather
-- than given as an offset, so the date holds across a DST change.
--
-- No grant: the deny-by-default privileges (20261001120000) leave it executable by its owner only.
-- can_view_medical runs as that owner. A client that needs the club's date gets its own grant.
create function public.club_today(p_at timestamptz default now())
returns date
language sql
stable
set search_path = ''
as $$
  select (p_at at time zone 'America/New_York')::date;
$$;

-- 2. Seasons. Each belongs to one program and runs from starts_on to ends_on, both club dates and
-- both inclusive.
create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs (id) on delete cascade,
  name text not null,
  starts_on date not null,
  ends_on date not null,
  constraint seasons_ends_on_or_after_starts_on check (ends_on >= starts_on),
  constraint seasons_program_name_key unique (program_id, name),
  -- The target of memberships' composite key, so a membership's season is always its program's.
  constraint seasons_id_program_key unique (id, program_id)
);

-- The ensure_rls trigger (20261001120000) has already enabled RLS; this line says so where the
-- table is made. Only the server reads seasons until the roster-read story (#43) grants
-- authenticated what it needs. Anon and authenticated are revoked by name, although the default
-- privileges left them nothing, so this file still holds if those defaults ever change.
alter table public.seasons enable row level security;
revoke all on table public.seasons from anon, authenticated;
grant select, insert, update, delete on table public.seasons to service_role;

-- 3. Memberships point at a season row instead of naming one.
--
-- The rows already here, in local databases holding earlier test runs, each get a season of their
-- own program under their old label. The hosted project holds none of the migrations yet, so it
-- has no rows to carry. A label has no dates, so each migrated season is dated as ended the day
-- before this file ran, in club time. An undated season grants nothing, which is this story's
-- point.
insert into public.seasons (program_id, name, starts_on, ends_on)
select distinct m.program_id, m.season, public.club_today() - 1, public.club_today() - 1
from public.memberships m;

alter table public.memberships add column season_id uuid;

update public.memberships m
set season_id = s.id
from public.seasons s
where s.program_id = m.program_id
  and s.name = m.season;

alter table public.memberships alter column season_id set not null;
alter table public.memberships drop constraint memberships_pkey;
alter table public.memberships drop column season;
alter table public.memberships
  add constraint memberships_pkey primary key (person_id, program_id, role, season_id);
alter table public.memberships
  add constraint memberships_season_of_program
  foreign key (season_id, program_id) references public.seasons (id, program_id) on delete cascade;

-- 4. Medical access follows the season: a coach or director sharing a season with the sailor, while
-- that season is current in club time. A season belongs to one program, and the composite key above
-- holds each membership to its season's program, so a shared season is a shared program too.
--
-- Replaced here rather than left alone: its body read memberships.season, which step 3 dropped. A
-- SQL function's body is not a dependency of the column it reads, so the drop succeeded and the old
-- body would have failed at its next call. `create or replace` keeps its owner, its definer rights
-- and the execute grant to authenticated.
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
      on sm.season_id = vm.season_id
     and sm.role = 'sailor'
    where viewer.auth_user_id = auth.uid()
      and sm.person_id = p_sailor
  );
$$;

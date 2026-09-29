-- The smallest schema the scaffold's one real test needs (ADR 002, ADR 009, ADR 011).
-- Everything else — events, attendance, guardians, towing — arrives with its own story and its
-- own migration. Schema changes only ever land as files in this directory, never by hand.

create table public.programs (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table public.people (
  id uuid primary key default gen_random_uuid(),
  -- A domain row the app owns, keyed separately from the auth id, so an auth account can be
  -- replaced without orphaning a sailor's history.
  auth_user_id uuid unique references auth.users (id) on delete set null,
  first_name text not null,
  last_name text not null
);

create type public.member_role as enum ('coach', 'director', 'treasurer', 'sailor');

-- Membership is per program and per season: access follows the season and lapses with it.
create table public.memberships (
  person_id uuid not null references public.people (id) on delete cascade,
  program_id uuid not null references public.programs (id) on delete cascade,
  role public.member_role not null,
  season text not null,
  primary key (person_id, program_id, role, season)
);

-- Medical flags: a fixed checklist plus one short "what to do" note (charter, Data).
-- App-level field encryption arrives with the medical Edge Function story (ADR 002); the
-- structural control that matters from day one is below — no client role can read this table.
create table public.medical_flags (
  sailor_id uuid primary key references public.people (id) on delete cascade,
  flags text[] not null default '{}',
  action_note text
);

alter table public.programs enable row level security;
alter table public.people enable row level security;
alter table public.memberships enable row level security;
alter table public.medical_flags enable row level security;

-- Supabase grants new public tables to anon and authenticated by default. For this table that
-- default is revoked outright, so a missing policy can never be the only thing standing between
-- a client and a child's medical flags.
revoke all on public.medical_flags from anon, authenticated;

-- The access decision the medical Edge Function will call before it decrypts anything: is the
-- caller a coach or director of a program this sailor sails in, this season? Guardians reach
-- their own child's card through a guardian-link rule added with that story.
create function public.can_view_medical(p_sailor uuid)
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
    join public.memberships sm
      on sm.program_id = vm.program_id
     and sm.season = vm.season
     and sm.role = 'sailor'
    where viewer.auth_user_id = auth.uid()
      and sm.person_id = p_sailor
  );
$$;

revoke execute on function public.can_view_medical(uuid) from public, anon;
grant execute on function public.can_view_medical(uuid) to authenticated;

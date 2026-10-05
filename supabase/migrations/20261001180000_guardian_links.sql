-- Link guardians to sailors so a guardian reads only their own children (#53, E3).
--
-- Until now nothing said whose child a sailor is, so no guardian could read anything and
-- can_view_medical admitted only coaches and directors. From this file a guardian is linked to each of
-- their children by one guardian_links row. The links are many-to-many: a guardian of two sailors is
-- one people row with two links, and a sailor in a split household has one link per guardian. A
-- signed-in guardian reads the people rows of the sailors they are currently linked to and nothing
-- else, and can_view_medical admits them for those sailors. A coach or director reads the current
-- links of the sailors on their roster (#43). No client writes a link.
-- tests/db/guardian-links.test.ts and tests/db/medical-access.test.ts fail when any of it stops
-- holding.

-- 1. The links. There is one row per guardian and sailor, ever. An unlink sets unlinked_at and keeps
-- the row, so the tombstone is what the Clubspot poll finds the next time it sees that pair, and the
-- poll must not relink them (D20: a guardian's edit wins over the poll; charter: an admin can unlink).
create table public.guardian_links (
  guardian_id uuid not null references public.people (id) on delete cascade,
  sailor_id uuid not null references public.people (id) on delete cascade,
  -- The guardian the still-missing row calls (D20).
  is_primary boolean not null default false,
  -- Set when the link ends. A link is current while this is null.
  unlinked_at timestamptz,
  primary key (guardian_id, sailor_id),
  constraint guardian_links_not_self check (guardian_id <> sailor_id)
);

-- At most one current link per sailor is primary. An unlinked primary does not count, so a sailor
-- whose primary guardian was unlinked can be given a new one.
create unique index guardian_links_one_current_primary
  on public.guardian_links (sailor_id)
  where is_primary and unlinked_at is null;

-- The primary key leads with the guardian. The coaches' policy and can_view_medical look a link up by
-- its sailor.
create index guardian_links_sailor_id on public.guardian_links (sailor_id);

-- The ensure_rls trigger (20261001120000) has already enabled RLS; this line says so where the table
-- is made. The deny-by-default privileges left anon and authenticated nothing, and they are revoked by
-- name anyway, so this file still holds if those defaults ever change.
alter table public.guardian_links enable row level security;
revoke all on table public.guardian_links from anon, authenticated;
grant select, insert, update, delete on table public.guardian_links to service_role;

-- 2. What a signed-in client may read of a link: who, whose, and whether primary. unlinked_at is
-- withheld, and the policy below admits current links only, so a coach never learns that a guardian
-- was unlinked (owner decision on #53, 2026-10-01). Column grants, as for the roster (#43), so a column
-- a later migration adds stays withheld until a grant names it.
grant select (guardian_id, sailor_id, is_primary) on table public.guardian_links to authenticated;

-- 3. A coach or director reads the current links of each sailor on their roster. The subquery runs as
-- the caller, so memberships_read_roster limits it to the current seasons of the programs they coach
-- or direct (#43), and this policy needs no scope of its own. A guardian reads no links, their own
-- included (owner decision on #53): they read their children's people rows instead (section 4).
create policy guardian_links_read_roster on public.guardian_links
  for select to authenticated
  using (
    unlinked_at is null
    and exists (select 1 from public.memberships m where m.person_id = guardian_links.sailor_id)
  );

-- 4. A guardian reads the people rows of the sailors they are currently linked to.
--
-- The one function this policy calls. It is a definer for the same two reasons as
-- private.my_roster_season_ids() (#43): it reads the caller's own people.auth_user_id, which no client
-- may select, and it reads guardian_links, which a guardian may not. It returns only the caller's own
-- facts, the ids of the sailors they are currently linked to, which D3 allows. It lives in `private`
-- for the same reason too: the Data API does not serve that schema, so no client can call it by name.
create function private.my_linked_sailor_ids()
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
   and gl.unlinked_at is null
  where viewer.auth_user_id = (select auth.uid());
$$;

-- The deny-by-default privileges already leave it executable by its owner only. Revoked by name
-- anyway, so this file still holds if those defaults ever change.
revoke all on function private.my_linked_sailor_ids() from public, anon, authenticated, service_role;
grant execute on function private.my_linked_sailor_ids() to authenticated;

create policy people_read_linked_sailors on public.people
  for select to authenticated
  using (id in (select private.my_linked_sailor_ids()));

-- 5. Medical access for guardians: a guardian currently linked to the sailor, in any season. The
-- charter gives a sailor's own guardians the card with no season attached, so unlike the coach clause
-- this one reads no dates. An unlinked guardian, or another sailor's guardian, is refused.
--
-- The coach clause is the body from 20261001140000, unchanged. `create or replace` keeps the
-- function's owner, its definer rights and the execute grant to authenticated.
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
  )
  or exists (
    select 1
    from public.people viewer
    join public.guardian_links gl
      on gl.guardian_id = viewer.id
     and gl.unlinked_at is null
    where viewer.auth_user_id = auth.uid()
      and gl.sailor_id = p_sailor
  );
$$;

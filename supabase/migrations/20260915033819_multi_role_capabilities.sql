-- Replaces the single `profiles.role` enum with a multi-role, capability-based
-- system. A user can hold several roles at once (e.g. 'officer' AND 'division'),
-- which have different, non-overlapping capabilities rather than one being a
-- superset of the other. 'guest' is no longer a stored value — it's simply
-- "zero rows in user_roles". 'member' is dropped (nothing ever distinguished
-- it from guest). 'division' is scoped to a specific division again via a new
-- lightweight `divisions` lookup table (separate from the `site_contents`
-- 'divisions' JSON blob that drives the public marketing page — untouched).
--
-- Also fixes two live bugs found while auditing the old system:
--   1. RLS policies said "officers can..." but checked `role_rank >= 2`, which
--      under the old numbering (division=2, lead=3, officer=4) let division
--      and lead through too, not just officers.
--   2. /portal/admin/content's page guard required officer+, but the save API
--      required lead/exec/admin (deliberately excluding officer) — an officer
--      could open the editor and have every save silently 403.
--
-- Only 4 profiles exist as of this writing, all role='guest', so the data
-- migration below is close to a no-op — there is no real elevated-role data
-- to lose.

begin;

-- ── New role enum + lookup/join tables ────────────────────────────────────

create type public.app_role as enum ('ucsd', 'division', 'officer', 'lead', 'exec', 'admin');

create table public.divisions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

-- Auto-seed from the existing marketing content block so slugs line up with
-- the live /divisions/[slug] routes with zero manual data entry.
insert into public.divisions (slug, name)
select lower(regexp_replace(item->>'name', '\s+', '-', 'g')), item->>'name'
from public.site_contents, jsonb_array_elements(content->'items') as item
where key = 'divisions'
on conflict (slug) do nothing;

create table public.user_roles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  role        public.app_role not null,
  division_id uuid references public.divisions(id) on delete cascade,
  granted_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now(),
  -- division_id required iff role='division', forbidden otherwise
  constraint user_roles_division_scope_ck check ((role = 'division') = (division_id is not null))
);

-- Unique on (user_id, role) only — not division_id, since Postgres treats
-- NULL <> NULL in uniqueness checks, which would defeat a constraint that
-- included it. This also deliberately caps a user at ONE division at a time;
-- to move someone, update division_id on their existing row.
create unique index user_roles_user_id_role_key on public.user_roles (user_id, role);
create index user_roles_division_id_idx on public.user_roles (division_id) where division_id is not null;

alter table public.user_roles enable row level security;

create policy "user_roles readable by everyone"
  on public.user_roles for select using (true);

-- ── Capability mapping (mirrors src/lib/capabilities.ts) ──────────────────

create table public.role_capabilities (
  role public.app_role not null,
  capability text not null,
  primary key (role, capability)
);

insert into public.role_capabilities (role, capability) values
  ('officer', 'manage_events'),
  ('lead',    'manage_events'),
  ('exec',    'manage_events'),
  ('officer', 'checkin'),
  ('lead',    'checkin'),
  ('exec',    'checkin'),
  ('lead',    'manage_site_content'),
  ('exec',    'manage_site_content'),
  ('division','manage_division'),
  ('lead',    'manage_division'),
  ('exec',    'manage_division'),
  ('exec',    'manage_sponsors'),
  ('officer', 'view_members'),
  ('lead',    'view_members'),
  ('exec',    'view_members'),
  ('exec',    'view_admin_dashboard');
-- 'admin' qualifies for every capability via has_capability() below, not
-- seeded per-row here. delete_events / delete_sponsors / manage_roles are
-- admin-only, so they need no rows either.

create or replace function public.has_capability(_capability text, _division_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and (
        ur.role = 'admin'
        or exists (
          select 1 from public.role_capabilities rc
          where rc.role = ur.role and rc.capability = _capability
            and (ur.role <> 'division' or _division_id is null or ur.division_id = _division_id)
        )
      )
  );
$$;

-- Used by the Role Manager UI to grant/revoke a user's whole role set
-- atomically (avoids partial-failure inconsistency from separate delete+insert
-- calls from the client). Called from api/admin/roles/route.ts via the
-- service-role client, which has no auth.uid() of its own — the caller (an
-- admin, already verified app-side via has_capability('manage_roles')) is
-- passed in explicitly as _granted_by rather than read from auth.uid().
create or replace function public.admin_set_user_roles(_user_id uuid, _roles jsonb, _granted_by uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.user_roles where user_id = _user_id;
  insert into public.user_roles (user_id, role, division_id, granted_by)
  select _user_id, (r->>'role')::app_role, nullif(r->>'division_id', '')::uuid, _granted_by
  from jsonb_array_elements(_roles) as r;
end;
$$;

-- ── Migrate existing data ──────────────────────────────────────────────────

-- 'officer'/'lead'/'exec'/'admin' map 1:1 by literal value. 'member' collapses
-- to guest (zero rows). 'division' is intentionally excluded: the new schema
-- requires a division_id that no existing row has, and there are zero
-- 'division'-role profiles today anyway (verified live before writing this).
insert into public.user_roles (user_id, role)
select id, role::text::public.app_role
from public.profiles
where role::text in ('officer', 'lead', 'exec', 'admin');

-- ── Auto-grant 'ucsd' at signup ────────────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;

  if new.email ilike '%@ucsd.edu' then
    insert into public.user_roles (user_id, role) values (new.id, 'ucsd') on conflict do nothing;
  end if;

  return new;
end;
$$;

-- ── RLS rewrite ────────────────────────────────────────────────────────────
-- Old policies are dropped BEFORE get_my_role()/role_rank()/user_role below —
-- those old policies reference them, so dropping the functions/type first
-- would fail with a dependency error.

drop policy if exists "Admins can delete events" on public.events;
drop policy if exists "Officers can manage events" on public.events;
drop policy if exists "Officers can update events" on public.events;
drop policy if exists "Published events visible to all" on public.events;

create policy "manage_events insert" on public.events
  for insert with check (has_capability('manage_events'));
create policy "manage_events update" on public.events
  for update using (has_capability('manage_events')) with check (has_capability('manage_events'));
create policy "delete_events" on public.events
  for delete using (has_capability('delete_events'));
create policy "published events visible to all" on public.events
  for select using (is_published or has_capability('view_members'));

drop policy if exists "Officers can update tickets (check-in)" on public.tickets;
create policy "checkin can update tickets" on public.tickets
  for update using (has_capability('checkin')) with check (has_capability('checkin'));

drop policy if exists "Users see their own tickets" on public.tickets;
create policy "users see their own tickets" on public.tickets
  for select using (auth.uid() = user_id or has_capability('checkin'));
-- "Users can register for events" policy is unchanged — it was never role-rank-based.

drop policy if exists "Officers can insert site content" on public.site_contents;
drop policy if exists "Officers can update site content" on public.site_contents;
create policy "site editors can insert content" on public.site_contents
  for insert with check (has_capability('manage_site_content'));
create policy "site editors can update content" on public.site_contents
  for update using (has_capability('manage_site_content')) with check (has_capability('manage_site_content'));

drop policy if exists "Admins manage sponsors" on public.sponsors;
drop policy if exists "Execs can manage sponsors" on public.sponsors;
drop policy if exists "Execs can update sponsors" on public.sponsors;
create policy "manage_sponsors insert" on public.sponsors
  for insert with check (has_capability('manage_sponsors'));
create policy "manage_sponsors update" on public.sponsors
  for update using (has_capability('manage_sponsors')) with check (has_capability('manage_sponsors'));
create policy "delete_sponsors" on public.sponsors
  for delete using (has_capability('delete_sponsors'));

-- ── Drop the old single-role column/type ──────────────────────────────────
-- Safe now that every policy referencing get_my_role()/role_rank() is gone.

alter table public.profiles drop column role;
drop function if exists public.get_my_role();
drop function if exists public.role_rank(public.user_role);
drop type if exists public.user_role;

commit;

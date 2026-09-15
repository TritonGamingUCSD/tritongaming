-- Moves division marketing content (logo, description, display order) off
-- the generic `site_contents` JSON blob (key='divisions') and onto the
-- `divisions` table itself, which already exists for role-scoping. The
-- public /divisions pages and LandingDivisions now read this table directly
-- instead of the content block — see src/lib/divisions.ts.

alter table public.divisions
  add column if not exists logo_url text,
  add column if not exists description text,
  add column if not exists order_index integer not null default 0;

-- Backfill from the old content block, matching by the same slug rule used
-- to auto-seed `divisions` in the first place (see the multi-role migration).
update public.divisions d
set
  logo_url = item->>'logo',
  description = item->>'description',
  order_index = coalesce((item->>'order')::int, 0)
from public.site_contents sc, jsonb_array_elements(sc.content->'items') as item
where sc.key = 'divisions'
  and d.slug = lower(regexp_replace(item->>'name', '\s+', '-', 'g'));

-- Retired now that `divisions` is the source of truth.
delete from public.site_contents where key = 'divisions';

-- New capability: exec/admin manage the whole divisions directory (add,
-- rename, edit content, remove). Distinct from `manage_division`, which is
-- scoped to a division lead editing only their own division's page.
insert into public.role_capabilities (role, capability) values ('exec', 'manage_divisions_directory');

drop policy if exists "admins insert divisions" on public.divisions;
drop policy if exists "admins update divisions" on public.divisions;
drop policy if exists "admins delete divisions" on public.divisions;

create policy "exec/admin insert divisions" on public.divisions
  for insert with check (has_capability('manage_divisions_directory'));

create policy "exec/admin update divisions" on public.divisions
  for update using (has_capability('manage_divisions_directory')) with check (has_capability('manage_divisions_directory'));

create policy "exec/admin delete divisions" on public.divisions
  for delete using (has_capability('manage_divisions_directory'));

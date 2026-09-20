-- Portal photo albums — a browsable list of past event Google Photos
-- albums, embedded as iframes. Distinct from events.photo_album_url (a
-- single link tied to one specific ticketed event, editable by whoever can
-- edit that event): this is a standalone list any lead+ can curate
-- directly, including albums that aren't tied to any one tracked event
-- (a semester highlight reel, a multi-event compilation, etc.), and it's
-- viewable by a broader audience (officer/recruit/alumni+, not just
-- manage_events holders).

begin;

insert into public.role_capabilities (role, capability) values
  ('officer',  'view_photo_albums'),
  ('division', 'view_photo_albums'),
  ('lead',     'view_photo_albums'),
  ('exec',     'view_photo_albums'),
  ('recruit',  'view_photo_albums'),
  ('alumni',   'view_photo_albums'),
  ('lead',     'manage_photo_albums'),
  ('exec',     'manage_photo_albums');
-- 'admin' qualifies for both via has_capability()'s own admin bypass, no
-- row needed.

create table public.photo_albums (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  url         text not null,
  event_id    uuid references public.events(id) on delete set null,
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now()
);

create index photo_albums_created_at_idx on public.photo_albums (created_at desc);

alter table public.photo_albums enable row level security;

create policy "photo albums readable by view_photo_albums"
  on public.photo_albums for select
  using (has_capability('view_photo_albums'));

create policy "photo albums manageable by manage_photo_albums"
  on public.photo_albums for all
  using (has_capability('manage_photo_albums'))
  with check (has_capability('manage_photo_albums'));

commit;

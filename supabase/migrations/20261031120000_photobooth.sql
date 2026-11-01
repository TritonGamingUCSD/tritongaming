-- Photo Booth: a booth for an event, run on a screen at the event. Guests choose an overlay, three photos are taken after a countdown, and a QR code opens a page where they download the finished picture.
-- Everything is read and written by the routes (service role); RLS is on with no policies. Pictures live in two public buckets with unguessable file names.

-- The overlay library: frames and stickers (transparent WebP pictures) shared by every event; each event's booth picks which ones to offer.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photobooth-overlays', 'photobooth-overlays', true, 614400, array['image/webp'])
on conflict (id) do update set public = true, file_size_limit = 614400, allowed_mime_types = array['image/webp'];
create policy "photobooth-overlays public read" on storage.objects for select using (bucket_id = 'photobooth-overlays');

-- The finished pictures guests download (a JPEG or WebP of about 0.3 to 1.5 MB); the daily job deletes them when they expire.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photobooth', 'photobooth', true, 2097152, array['image/jpeg', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 2097152, allowed_mime_types = array['image/jpeg', 'image/webp'];
create policy "photobooth public read" on storage.objects for select using (bucket_id = 'photobooth');

create table if not exists public.photobooth_overlays (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(name) between 1 and 60),
  kind        text not null check (kind in ('frame', 'sticker')),
  image       text not null,                                         -- the picture's full public address
  -- A sticker's starting place and size (fractions of the photo: x and y are its centre, size is its width) and what a guest may do with it.
  x           real not null default 0.5 check (x between 0 and 1),
  y           real not null default 0.3 check (y between 0 and 1),
  size        real not null default 0.3 check (size between 0.05 and 1),
  can_resize  boolean not null default true,
  can_rotate  boolean not null default true,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- One booth per event: how it looks, what it takes and which overlays it offers.
create table if not exists public.photobooths (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null unique references public.events(id) on delete cascade,
  layout         text not null default 'strip3' check (layout in ('single', 'grid', 'strip3', 'strip4')),
  aspect         text not null default 'portrait' check (aspect in ('portrait', 'square', 'wide')),
  countdown      int  not null default 3 check (countdown between 1 and 10),
  mirror         boolean not null default true,
  filter         text not null default 'none' check (filter in ('none', 'bw', 'warm', 'vivid')),
  strip_bg       text not null default '#ffffff' check (strip_bg ~ '^#[0-9a-fA-F]{6}$'),
  text_color     text not null default '#011941' check (text_color ~ '^#[0-9a-fA-F]{6}$'),
  accent         text not null default '#facc15' check (accent ~ '^#[0-9a-fA-F]{6}$'),
  footer         text not null default '' check (length(footer) <= 80),   -- text under the photos (event name, date, hashtag)
  welcome_title  text not null default 'Photo Booth' check (length(welcome_title) between 1 and 60),
  welcome_text   text not null default 'Tap to start' check (length(welcome_text) <= 120),
  prompts        text[] not null default '{}' check (cardinality(prompts) <= 6),   -- a message before each shot, in order
  sounds         boolean not null default true,
  flash          boolean not null default true,
  qr_seconds     int  not null default 60 check (qr_seconds between 10 and 300),
  keep_days      int  not null default 7 check (keep_days between 1 and 7),
  overlay_ids    uuid[] not null default '{}' check (cardinality(overlay_ids) <= 24),
  updated_at     timestamptz not null default now(),
  created_at     timestamptz not null default now()
);

-- One row per finished picture: the link is /photos/<token>.
create table if not exists public.photobooth_photos (
  id         uuid primary key default gen_random_uuid(),
  token      text not null unique check (length(token) >= 16),
  booth_id   uuid references public.photobooths(id) on delete set null,
  event_id   uuid references public.events(id) on delete set null,
  path       text not null,                                           -- the file in the 'photobooth' bucket
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists photobooth_photos_expires on public.photobooth_photos (expires_at);
create index if not exists photobooth_photos_booth on public.photobooth_photos (booth_id, created_at desc);

alter table public.photobooth_overlays enable row level security;
alter table public.photobooths enable row level security;
alter table public.photobooth_photos enable row level security;

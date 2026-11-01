-- Photo Booth: a booth offers up to 6 looks and guests pick one before their photos. A look is a frame, stickers, strip colours, footer words and a colour filter;
-- the booth keeps layout, shape, countdown, prompts, sounds, welcome words and the rest. Each existing booth gets one look called 'Main' made from what it has now.
-- Also: each sticker shows on the photos the host picks (a bit for each photo, the first photo is the lowest bit; 255 = all), guests no longer choose or edit stickers,
-- and the camera is always shown mirrored while the saved pictures never are (the way a phone's front camera works). Safe to run once.

create table if not exists public.photobooth_looks (
  id           uuid primary key default gen_random_uuid(),
  booth_id     uuid not null references public.photobooths(id) on delete cascade,
  name         text not null check (length(name) between 1 and 40),
  position     int  not null default 0,
  frame_image  text not null default '',          -- the look's own frame, drawn over each photo: the public address of its WebP ('' for none)
  frame_design jsonb,                             -- what the frame is made of (border, words, logo), so it can be edited again
  strip_bg     text not null default '#ffffff' check (strip_bg ~ '^#[0-9a-fA-F]{6}$'),
  text_color   text not null default '#011941' check (text_color ~ '^#[0-9a-fA-F]{6}$'),
  footer       text not null default '' check (length(footer) <= 80),
  filter       text not null default 'none' check (filter in ('none', 'bw', 'warm', 'vivid')),
  created_at   timestamptz not null default now()
);
create index if not exists photobooth_looks_booth on public.photobooth_looks (booth_id, position);
alter table public.photobooth_looks enable row level security;

-- One look per booth from what the booth has now (only when the booth still has the old columns, so running this twice does nothing more).
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'photobooths' and column_name = 'frame_image') then
    insert into public.photobooth_looks (booth_id, name, position, frame_image, frame_design, strip_bg, text_color, footer, filter)
    select b.id, 'Main', 0, b.frame_image, b.frame_design, b.strip_bg, b.text_color, b.footer, b.filter
    from public.photobooths b
    where not exists (select 1 from public.photobooth_looks l where l.booth_id = b.id);
  end if;
end $$;

alter table public.photobooth_overlays add column if not exists look_id uuid references public.photobooth_looks(id) on delete cascade;
update public.photobooth_overlays o set look_id = (select l.id from public.photobooth_looks l where l.booth_id = o.booth_id order by l.position limit 1) where o.look_id is null;
alter table public.photobooth_overlays alter column look_id set not null;
alter table public.photobooth_overlays add column if not exists photos integer not null default 255;
alter table public.photobooth_overlays drop column if exists can_resize;
alter table public.photobooth_overlays drop column if exists can_rotate;

alter table public.photobooths drop column if exists frame_image;
alter table public.photobooths drop column if exists frame_design;
alter table public.photobooths drop column if exists strip_bg;
alter table public.photobooths drop column if exists text_color;
alter table public.photobooths drop column if exists footer;
alter table public.photobooths drop column if exists filter;
alter table public.photobooths drop column if exists mirror;
alter table public.photobooths drop column if exists guest_stickers;

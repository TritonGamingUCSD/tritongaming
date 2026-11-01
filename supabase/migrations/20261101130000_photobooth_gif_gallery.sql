-- Photo Booth: an animated picture (a GIF of the shots) beside each finished picture, an event gallery of the pictures guests choose to share, one public gallery address per booth.
-- Additive: nothing the booth already does changes. Safe to run once.

-- The photos bucket takes GIFs too (the same 2 MB limit).
update storage.buckets set allowed_mime_types = array['image/jpeg', 'image/webp', 'image/gif'] where id = 'photobooth';

alter table public.photobooth_photos add column if not exists gif_path text;                                  -- the animated picture in the 'photobooth' bucket (null when there is none)
alter table public.photobooth_photos add column if not exists shared boolean not null default false;          -- the guest chose to show it in the booth's gallery
create index if not exists photobooth_photos_shared on public.photobooth_photos (booth_id, created_at desc) where shared;

-- The booth's gallery lives at /gallery/<gallery_token>: 22 random letters and digits like a picture's token, so the address cannot be guessed.
alter table public.photobooths add column if not exists gallery_token text unique;
update public.photobooths set gallery_token = substr(translate(encode(gen_random_bytes(24), 'base64'), '+/=', 'abc'), 1, 22) where gallery_token is null;
alter table public.photobooths alter column gallery_token set default substr(translate(encode(gen_random_bytes(24), 'base64'), '+/=', 'abc'), 1, 22);
alter table public.photobooths alter column gallery_token set not null;

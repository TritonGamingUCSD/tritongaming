-- Photo Booth: a sticker now belongs to the picture as a whole (it sits above every photo and frame and can reach over onto the next photo), not to one photo. Its `placements` entries are copies of the sticker with their place as fractions of the WHOLE
-- picture, instead of one entry per photo with fractions of that photo.
-- `stickers_on_picture` says which a look's stickers are in: the stickers already there were placed per photo (false) until scripts/convert-sticker-space.mjs turns them into picture places (true); looks made from now on start as true.
-- Additive. Safe to run once.
alter table public.photobooth_looks add column if not exists stickers_on_picture boolean not null default false;
alter table public.photobooth_looks alter column stickers_on_picture set default true;

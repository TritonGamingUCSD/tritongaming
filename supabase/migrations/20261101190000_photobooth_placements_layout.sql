-- Photo Booth: each sticker has its own place, size and turn on each photo (so the same sticker can sit differently on every photo, or be left off a photo), and each look has its own layout and photo shape.
-- Additive: the old sticker columns (x, y, size, photos) stay unused for now and the booth's own layout and shape stay as the defaults a look starts from. Safe to run once.

alter table public.photobooth_looks add column if not exists layout text not null default 'strip3' check (layout in ('single', 'grid', 'strip3', 'strip4'));
alter table public.photobooth_looks add column if not exists aspect text not null default 'portrait' check (aspect in ('portrait', 'square', 'wide'));
update public.photobooth_looks l set layout = b.layout, aspect = b.aspect from public.photobooths b where b.id = l.booth_id;

-- placements: one entry per photo (up to 4): { x, y, size, rotation (degrees) } or null when the photo does not show the sticker.
alter table public.photobooth_overlays add column if not exists placements jsonb not null default '[]'::jsonb;
update public.photobooth_overlays o set placements = (
  select jsonb_agg(case when ((o.photos >> i) & 1) = 1 then jsonb_build_object('x', o.x, 'y', o.y, 'size', o.size, 'rotation', 0) else 'null'::jsonb end order by i)
  from generate_series(0, 3) as i
)
where o.placements = '[]'::jsonb;

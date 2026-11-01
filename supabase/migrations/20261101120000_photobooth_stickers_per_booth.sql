-- Photo Booth: stickers belong to the booth that offers them (like its frame), made right in the booth's studio, instead of one shared library.
-- Each booth gets its own row for every sticker it offered (the rows may point at the same picture file; the routes only delete a file when no row uses it any more).
-- Stickers no booth offered are dropped. Safe to run once.

alter table public.photobooth_overlays add column if not exists booth_id uuid references public.photobooths(id) on delete cascade;
alter table public.photobooth_overlays add column if not exists position int not null default 0;

insert into public.photobooth_overlays (name, kind, image, x, y, size, can_resize, can_rotate, created_by, booth_id, position)
select o.name, o.kind, o.image, o.x, o.y, o.size, o.can_resize, o.can_rotate, o.created_by, b.id, u.ord::int
from public.photobooths b
cross join lateral unnest(b.overlay_ids) with ordinality as u(oid, ord)
join public.photobooth_overlays o on o.id = u.oid and o.booth_id is null;

delete from public.photobooth_overlays where booth_id is null;

alter table public.photobooth_overlays alter column booth_id set not null;
create index if not exists photobooth_overlays_booth on public.photobooth_overlays (booth_id, position);

alter table public.photobooths drop column if exists overlay_ids;

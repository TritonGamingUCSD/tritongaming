-- Manual ordering for the portal's Photo Albums list (public.photo_albums,
-- see 20260920040512_add_photo_albums.sql) — it only had created_at, so the
-- grid always showed newest-first with no way for a lead/exec to pin a
-- specific album higher. Lower sort_order shows first; the backfill
-- preserves today's existing newest-first order as the starting point so
-- nothing visibly reshuffles the moment this ships.
alter table public.photo_albums
  add column if not exists sort_order integer;

with ranked as (
  select id, row_number() over (order by created_at desc) as rn
  from public.photo_albums
)
update public.photo_albums p
set sort_order = ranked.rn
from ranked
where p.id = ranked.id;

alter table public.photo_albums
  alter column sort_order set not null,
  alter column sort_order set default 0;

create index if not exists photo_albums_sort_order_idx on public.photo_albums (sort_order);

-- Lets an event optionally be tagged as belonging to a division, so the
-- public /divisions/[slug] page can show that division's own upcoming events
-- instead of being pure static marketing copy. Nullable — most events aren't
-- division-specific — and set null (not cascaded) if the division is ever
-- deleted, since the event itself should still exist either way.

begin;

alter table public.events
  add column division_id uuid references public.divisions(id) on delete set null;

create index events_division_id_idx on public.events (division_id) where division_id is not null;

commit;

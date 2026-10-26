-- Prizing: where a prize is from. Besides the sponsor (or the club) and the free-text note, a prize remembers the event it was received for (a name that stays when the event is later removed, and
-- the event's id while it exists; no foreign key, like the rest of Logistics). Which events a prize was used at is worked out from the stations it was put on, not stored.
alter table public.logistics_prizes add column if not exists from_event text check (from_event is null or length(from_event) <= 120);
alter table public.logistics_prizes add column if not exists from_plan_id uuid;

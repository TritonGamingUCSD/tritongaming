-- Per-day check-ins for multi-day events: one row per ticket per Pacific calendar day.
-- (tickets.status/checked_in_at still record the FIRST check-in and drive points; this
-- table records every day someone actually showed up.)
create table if not exists public.ticket_checkins (
  id            uuid primary key default gen_random_uuid(),
  ticket_id     uuid not null references public.tickets(id) on delete cascade,
  event_id      uuid not null references public.events(id) on delete cascade,
  day           date not null,
  checked_in_at timestamptz not null default now(),
  checked_in_by uuid references public.profiles(id) on delete set null,
  unique (ticket_id, day)
);
create index if not exists ticket_checkins_event_day_idx on public.ticket_checkins (event_id, day);

alter table public.ticket_checkins enable row level security;
create policy "ticket check-ins readable by owner or staff" on public.ticket_checkins for select
  using (
    has_capability('checkin')
    or exists (select 1 from public.tickets t where t.id = ticket_checkins.ticket_id and t.user_id = auth.uid())
  );
-- Writes happen only through the server (service role).

-- Backfill: every ticket already checked in gets a row for the day it was scanned.
insert into public.ticket_checkins (ticket_id, event_id, day, checked_in_at, checked_in_by)
select t.id, t.event_id, (t.checked_in_at at time zone 'America/Los_Angeles')::date, t.checked_in_at, t.checked_in_by
from public.tickets t
where t.checked_in_at is not null
on conflict (ticket_id, day) do nothing;

-- Richer public event pages: venue, schedule, sponsors, and a "who's going" count.
alter table public.events
  add column if not exists venue_address text,
  add column if not exists venue_notes text,
  add column if not exists schedule jsonb not null default '[]'::jsonb,
  add column if not exists sponsors jsonb not null default '[]'::jsonb;

-- Public headcount of people with a ticket (not cancelled). Aggregate only —
-- no names — so it's safe to expose to logged-out visitors.
create or replace function public.event_going_count(p_event_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.tickets t
  join public.events e on e.id = t.event_id
  where t.event_id = p_event_id and t.status <> 'cancelled' and e.is_published;
$$;
grant execute on function public.event_going_count(uuid) to anon, authenticated;

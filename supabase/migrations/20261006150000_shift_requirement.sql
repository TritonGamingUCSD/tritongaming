-- The least number of shift slots each active officer or lead needs to take at an event (null = no requirement).
alter table public.event_shifts add column if not exists min_per_person integer check (min_per_person is null or min_per_person between 1 and 48);

-- Times someone is away during an event (exec marks them): they can't take shifts that overlap it, and they need fewer shifts overall.
create table if not exists public.shift_absences (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  needs integer not null default 0 check (needs between 0 and 48),   -- how many shifts they still need, set per person (usually fewer)
  marked_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists shift_absences_event_idx on public.shift_absences (event_id, user_id);
alter table public.shift_absences enable row level security;

-- A short description of what the station does, shown on the sign-up tab.
alter table public.shift_stations add column if not exists description text check (description is null or char_length(description) <= 240);

-- Claiming a cell is atomic: everyone claiming in the same event and time slot waits their turn (an advisory lock), so two people can never take
-- the last spot at once, and nobody can end up in two stations in the same slot. Returns 'ok', 'full', 'clash' (already in that slot) or 'away'.
create or replace function public.claim_shift(p_event uuid, p_station uuid, p_slot int, p_user uuid, p_slot_start timestamptz, p_slot_end timestamptz)
returns text language plpgsql security definer set search_path = public as $$
declare needed int; here int;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_event::text || ':' || p_slot::text, 0));
  if exists (select 1 from shift_signups where event_id = p_event and station_id = p_station and slot_index = p_slot and user_id = p_user) then return 'ok'; end if;
  if exists (select 1 from shift_signups where event_id = p_event and slot_index = p_slot and user_id = p_user) then return 'clash'; end if;
  if exists (select 1 from shift_absences where event_id = p_event and user_id = p_user and starts_at < p_slot_end and ends_at > p_slot_start) then return 'away'; end if;
  select coalesce((select o.needed from shift_overrides o where o.event_id = p_event and o.station_id = p_station and o.slot_index = p_slot), (select s.default_needed from shift_stations s where s.id = p_station), 0) into needed;
  select count(*) into here from shift_signups where event_id = p_event and station_id = p_station and slot_index = p_slot;
  if here >= needed then return 'full'; end if;
  insert into shift_signups (event_id, station_id, slot_index, user_id) values (p_event, p_station, p_slot, p_user);
  return 'ok';
end $$;
revoke all on function public.claim_shift(uuid, uuid, int, uuid, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.claim_shift(uuid, uuid, int, uuid, timestamptz, timestamptz) to service_role;

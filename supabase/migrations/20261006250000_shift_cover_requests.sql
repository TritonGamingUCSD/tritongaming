-- Swap and cover requests: someone who can't work a shift asks the team to cover it; anyone eligible takes it; exec is told and can undo.
create table public.shift_cover_requests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  station_id uuid not null references public.shift_stations(id) on delete cascade,
  slot_index int not null check (slot_index >= 0),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  note text,
  status text not null default 'open' check (status in ('open', 'taken', 'cancelled', 'undone')),
  taken_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create unique index shift_cover_open_idx on public.shift_cover_requests (event_id, station_id, slot_index, requester_id) where status = 'open';
create index shift_cover_event_idx on public.shift_cover_requests (event_id);
alter table public.shift_cover_requests enable row level security;   -- the routes use the service role; nobody reads it directly

-- Hand the requester's slot to someone else in one step (locked, so two people tapping "I'll take it" cannot both get it).
create or replace function public.take_shift_cover(p_request uuid, p_user uuid, p_slot_start timestamptz, p_slot_end timestamptz)
returns text language plpgsql security definer set search_path = public as $$
declare r shift_cover_requests;
begin
  select * into r from shift_cover_requests where id = p_request for update;
  if not found or r.status <> 'open' then return 'gone'; end if;
  if r.requester_id = p_user then return 'self'; end if;
  if not exists (select 1 from shift_signups where event_id = r.event_id and station_id = r.station_id and slot_index = r.slot_index and user_id = r.requester_id) then
    update shift_cover_requests set status = 'cancelled', resolved_at = now() where id = r.id;
    return 'gone';
  end if;
  if exists (select 1 from shift_signups where event_id = r.event_id and slot_index = r.slot_index and user_id = p_user) then return 'clash'; end if;
  if exists (select 1 from shift_absences where event_id = r.event_id and user_id = p_user and starts_at < p_slot_end and ends_at > p_slot_start) then return 'away'; end if;
  delete from shift_signups where event_id = r.event_id and station_id = r.station_id and slot_index = r.slot_index and user_id = r.requester_id;
  insert into shift_signups (event_id, station_id, slot_index, user_id) values (r.event_id, r.station_id, r.slot_index, p_user);
  update shift_cover_requests set status = 'taken', taken_by = p_user, resolved_at = now() where id = r.id;
  return 'ok';
end $$;

-- Exec undoes a taken cover: the taker comes off and the original person goes back on (if they are still free then).
create or replace function public.undo_shift_cover(p_request uuid)
returns text language plpgsql security definer set search_path = public as $$
declare r shift_cover_requests;
begin
  select * into r from shift_cover_requests where id = p_request for update;
  if not found or r.status <> 'taken' then return 'gone'; end if;
  if exists (select 1 from shift_signups where event_id = r.event_id and slot_index = r.slot_index and user_id = r.requester_id) then return 'clash'; end if;
  delete from shift_signups where event_id = r.event_id and station_id = r.station_id and slot_index = r.slot_index and user_id = r.taken_by;
  insert into shift_signups (event_id, station_id, slot_index, user_id) values (r.event_id, r.station_id, r.slot_index, r.requester_id);
  update shift_cover_requests set status = 'undone', resolved_at = now() where id = r.id;
  return 'ok';
end $$;
revoke all on function public.take_shift_cover(uuid, uuid, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.undo_shift_cover(uuid) from public, anon, authenticated;
grant execute on function public.take_shift_cover(uuid, uuid, timestamptz, timestamptz) to service_role;
grant execute on function public.undo_shift_cover(uuid) to service_role;

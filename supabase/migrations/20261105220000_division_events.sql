-- Events can belong to a division (step 3 of the division project). events.division_id says who owns an event: empty is Triton Gaming (every event so far), a division id is that division. Other divisions or
-- Triton Gaming can be added as co-hosts (event_cohosts, an invite the other side accepts). Three small helper functions answer "is the signed-in person a Head or Member of this division" and "exec or admin".
-- Rules for the events table: everything that worked before still works for Triton Gaming's own events. A division's event can be created and edited by that division's Heads and by exec and admin (a TG lead can
-- not edit a division's event), deleted by its Heads (and admins as before), and its Heads see its drafts. A division's Members and Heads may update the tickets of its events (check-in).
-- Additive for the data (nothing existing changes meaning). Safe to run once.
alter table public.events add column if not exists division_id uuid references public.divisions(id) on delete set null;
create index if not exists events_division_id_idx on public.events (division_id) where division_id is not null;

create table if not exists public.event_cohosts (
  event_id    uuid not null references public.events(id) on delete cascade,
  division_id uuid references public.divisions(id) on delete cascade,   -- empty: Triton Gaming itself
  status      text not null default 'invited' check (status in ('invited', 'accepted')),
  invited_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create unique index if not exists event_cohosts_unique on public.event_cohosts (event_id, coalesce(division_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index if not exists event_cohosts_division_idx on public.event_cohosts (division_id) where division_id is not null;
alter table public.event_cohosts enable row level security;   -- read and written by the server only (service role)

create or replace function public.is_division_head(_division uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select _division is not null and exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'division' and division_id = _division);
$$;
create or replace function public.is_division_member(_division uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select _division is not null and exists (select 1 from public.user_roles where user_id = auth.uid() and role in ('division', 'division_member') and division_id = _division);
$$;
create or replace function public.is_tg_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role in ('exec', 'admin'));
$$;
revoke all on function public.is_division_head(uuid), public.is_division_member(uuid), public.is_tg_staff() from public, anon;
grant execute on function public.is_division_head(uuid), public.is_division_member(uuid), public.is_tg_staff() to authenticated;

drop policy if exists "manage_events insert" on public.events;
create policy "manage_events insert" on public.events for insert with check (
  (division_id is null and has_capability('manage_events')) or is_tg_staff() or (division_id is not null and is_division_head(division_id))
);
drop policy if exists "manage_events update" on public.events;
create policy "manage_events update" on public.events
  for update using ((division_id is null and has_capability('manage_events')) or is_tg_staff() or (division_id is not null and is_division_head(division_id)))
  with check ((division_id is null and has_capability('manage_events')) or is_tg_staff() or (division_id is not null and is_division_head(division_id)));
drop policy if exists "division heads delete their events" on public.events;
create policy "division heads delete their events" on public.events for delete using (division_id is not null and is_division_head(division_id));
drop policy if exists "division heads see their drafts" on public.events;
create policy "division heads see their drafts" on public.events for select using (division_id is not null and (is_division_head(division_id) or is_tg_staff()));

drop policy if exists "division members check in tickets" on public.tickets;
create policy "division members check in tickets" on public.tickets for update
  using (exists (select 1 from public.events e where e.id = tickets.event_id and e.division_id is not null and is_division_member(e.division_id)))
  with check (exists (select 1 from public.events e where e.id = tickets.event_id and e.division_id is not null and is_division_member(e.division_id)));
drop policy if exists "division members see their event tickets" on public.tickets;
create policy "division members see their event tickets" on public.tickets for select
  using (exists (select 1 from public.events e where e.id = tickets.event_id and e.division_id is not null and is_division_member(e.division_id)));

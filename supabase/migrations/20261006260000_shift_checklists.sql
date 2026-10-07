-- Station checklists: exec writes a short list per event and station (Setup > Guides); people on that station tick items off during the shift.
create table public.shift_checklist_items (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  station_id uuid not null references public.shift_stations(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 120),
  sort_order int not null default 0,
  done_by uuid references public.profiles(id) on delete set null,
  done_at timestamptz
);
create index shift_checklist_event_idx on public.shift_checklist_items (event_id, station_id, sort_order);
alter table public.shift_checklist_items enable row level security;   -- the routes use the service role; nobody reads it directly

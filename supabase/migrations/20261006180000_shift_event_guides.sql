-- Per-event part of a station guide: where it is this time, extra notes for this event, and this event's script. Blank fields fall back to the station's.
create table public.shift_event_guides (
  event_id uuid not null references public.events(id) on delete cascade,
  station_id uuid not null references public.shift_stations(id) on delete cascade,
  location text check (location is null or char_length(location) <= 120),
  notes text check (notes is null or char_length(notes) <= 4000),
  doc_id uuid references public.docs(id) on delete set null,
  link_url text check (link_url is null or char_length(link_url) <= 500),
  link_label text check (link_label is null or char_length(link_label) <= 60),
  primary key (event_id, station_id)
);
alter table public.shift_event_guides enable row level security;

-- The two category colors on the grid (one row). Exec change them in Setup.
create table public.shift_settings (
  id boolean primary key default true check (id),
  general_color text not null default '#2563eb' check (general_color ~ '^#[0-9a-fA-F]{6}$'),
  team_color text not null default '#7c3aed' check (team_color ~ '^#[0-9a-fA-F]{6}$')
);
insert into public.shift_settings (id) values (true) on conflict do nothing;
alter table public.shift_settings enable row level security;

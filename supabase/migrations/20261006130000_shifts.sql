-- Officer shifts: stations (rows) by time slots (columns) for each event. Exec set up the stations, how many people each cell needs (a default per
-- station, and overrides per cell), and open signup; officers and leads claim cells. All access goes through the API (service role), so these
-- tables have row level security on and no direct policies.
create table public.shift_stations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 60),
  default_needed int not null default 1 check (default_needed between 0 and 50),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.event_shifts (
  event_id uuid primary key references public.events(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  slot_minutes int not null default 60 check (slot_minutes in (15, 30, 45, 60, 90, 120)),
  signup_open boolean not null default false,
  team_only boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.shift_overrides (
  event_id uuid not null references public.events(id) on delete cascade,
  station_id uuid not null references public.shift_stations(id) on delete cascade,
  slot_index int not null check (slot_index >= 0),
  needed int not null check (needed between 0 and 50),
  primary key (event_id, station_id, slot_index)
);

create table public.shift_signups (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  station_id uuid not null references public.shift_stations(id) on delete cascade,
  slot_index int not null check (slot_index >= 0),
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (event_id, station_id, slot_index, user_id)
);
create index shift_signups_event_idx on public.shift_signups (event_id);
create index shift_signups_user_idx on public.shift_signups (user_id);

alter table public.shift_stations enable row level security;
alter table public.event_shifts enable row level security;
alter table public.shift_overrides enable row level security;
alter table public.shift_signups enable row level security;

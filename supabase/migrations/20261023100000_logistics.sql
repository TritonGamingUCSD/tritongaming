-- Logistics, stage 1: the equipment catalog. A self-contained set of tables (nothing here touches events, tickets, check-in or meetings). No client access: every read and write goes
-- through the server's service role, which checks the view_logistics / manage_logistics permissions.

-- The editable dropdown lists ("like a spreadsheet's dropdown"): device types (meta.counted = tracked by an approximate quantity instead of one row per item), shelves, tiers,
-- ports, extra games (the portal's own game list is read live by the app), and the names of kit parts.
create table if not exists public.logistics_options (
  id     uuid primary key default gen_random_uuid(),
  kind   text not null check (kind in ('type', 'shelf', 'tier', 'port', 'game', 'kit')),
  value  text not null check (length(btrim(value)) between 1 and 80),
  sort   int  not null default 0,
  meta   jsonb not null default '{}'::jsonb
);
create unique index if not exists logistics_options_unique on public.logistics_options (kind, lower(btrim(value)));
alter table public.logistics_options enable row level security;

create table if not exists public.logistics_sponsors (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(btrim(name)) between 1 and 120),
  contact    text,
  notes      text,
  created_at timestamptz not null default now()
);
create unique index if not exists logistics_sponsors_name on public.logistics_sponsors (lower(btrim(name)));
alter table public.logistics_sponsors enable row level security;

create table if not exists public.logistics_devices (
  id                   uuid primary key default gen_random_uuid(),
  tag                  text check (tag is null or length(btrim(tag)) between 1 and 40),     -- the ID written on the device (TECM1, PA1); optional only for counted rows
  tag_key              text generated always as (lower(regexp_replace(tag, '\s+', '', 'g'))) stored,
  name                 text check (name is null or length(name) <= 120),
  type                 text not null,
  shelf                text,
  tier                 text,
  place_note           text check (place_note is null or length(place_note) <= 200),
  condition            text not null default 'not_tested' check (condition in ('brand_new', 'working', 'dead', 'disappeared', 'threw_away', 'not_tested')),
  owner_type           text not null default 'club' check (owner_type in ('club', 'sponsor', 'officer')),
  owner_user_id        uuid references public.profiles(id) on delete set null,             -- the officer, for an officer loaner
  sponsor_id           uuid references public.logistics_sponsors(id) on delete set null,
  owner_note           text check (owner_note is null or length(owner_note) <= 300),
  ports                text[] not null default '{}',
  login                text check (login is null or length(login) <= 200),
  games                text[] not null default '{}',
  kit                  jsonb not null default '[]'::jsonb,                                  -- [{ item, qty, missing }]
  quantity             int check (quantity is null or quantity between 0 and 100000),      -- counted types only
  quantity_is_estimate boolean not null default true,
  notes                text check (notes is null or length(notes) <= 2000),
  created_by           uuid,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create unique index if not exists logistics_devices_tag_key on public.logistics_devices (tag_key) where tag_key is not null;
create index if not exists logistics_devices_type on public.logistics_devices (type);
create index if not exists logistics_devices_shelf on public.logistics_devices (shelf);
create index if not exists logistics_devices_condition on public.logistics_devices (condition);
alter table public.logistics_devices enable row level security;

-- What happened to a device: condition changes, moves, missing parts, notes. One line each.
create table if not exists public.logistics_device_log (
  id        uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.logistics_devices(id) on delete cascade,
  at        timestamptz not null default now(),
  actor_id  uuid,
  kind      text not null,
  summary   text not null check (length(summary) <= 400)
);
create index if not exists logistics_device_log_device on public.logistics_device_log (device_id, at desc);
alter table public.logistics_device_log enable row level security;

-- Starting values (all editable in the portal).
insert into public.logistics_options (kind, value, sort, meta)
select 'type', v, row_number() over (), '{}'::jsonb from unnest(array[
  'Keyboard', 'Microphone', 'Headset', 'Gaming Laptop', 'Gaming PC', 'Monitor', 'Mouse', 'Ethernet Cables', 'Ethernet Switch', 'Extension Cord', 'Gamecube Controller', 'Mousepad',
  'Nintendo Switch', 'Nintendo Switch - Left Joycon', 'Nintendo Switch - Right Joycon', 'Nintendo Switch Dock', 'Non-Gaming Laptop', 'Non-Gaming PC', 'Other', 'Power Strip',
  'Speaker', 'Switch Pro Controller', 'TV', 'Wacom Tablet', 'Webcam', 'WiFi Router']) as v
on conflict do nothing;
insert into public.logistics_options (kind, value, sort)
select 'shelf', v, row_number() over () from unnest(array['Shelf A', 'Shelf B', 'Shelf C', 'Shelf D', 'Shelf E', 'Shelf F', 'Shelf G', 'Shelf H', 'Shelf I', 'Center Stack']) as v
on conflict do nothing;
insert into public.logistics_options (kind, value, sort)
select 'tier', v, row_number() over () from unnest(array['T0', 'T1', 'T2', 'T3', 'T4', 'T5']) as v
on conflict do nothing;
insert into public.logistics_options (kind, value, sort)
select 'port', v, row_number() over () from unnest(array['HDMI', 'DisplayPort', 'USB-A', 'USB-C', 'Ethernet', 'VGA', 'Thunderbolt', '3.5mm audio']) as v
on conflict do nothing;
insert into public.logistics_options (kind, value, sort)
select 'kit', v, row_number() over () from unnest(array[
  'Power cable', 'Power adapter', 'Charger', 'HDMI cable', 'DisplayPort cable', 'USB cable', 'USB-C cable', 'Audio cable', 'Ethernet cable', 'Keyboard', 'Mouse',
  'Controller', 'Left Joycon', 'Right Joycon', 'Dock', 'Remote', 'Stand', 'Pen', 'Wireless receiver', 'GameCube adapter']) as v
on conflict do nothing;

-- Logistics, stage 2: event plans (which devices go to an event and where), and the event-day steps each device goes through. Still separate from events, tickets and check-in:
-- a plan stores its event's id as a plain value with NO foreign key, so deleting an event is never blocked or touched by Logistics.

-- The editable lists gain two kinds: the steps a device goes through (in order; meta.applies says which devices: all, club-owned only, or borrowed only), and setup
-- bundles (meta.items = [{ type, qty }]).
alter table public.logistics_options drop constraint if exists logistics_options_kind_check;
alter table public.logistics_options add constraint logistics_options_kind_check check (kind in ('type', 'shelf', 'tier', 'port', 'game', 'kit', 'step', 'bundle'));

create table if not exists public.logistics_plans (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(btrim(name)) between 1 and 120),
  event_id   uuid,                                            -- a portal event, or null for a Logistics-only event
  starts_on  date not null,
  ends_on    date not null,
  status     text not null default 'draft' check (status in ('draft', 'closed')),
  notes      text check (notes is null or length(notes) <= 2000),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);
create index if not exists logistics_plans_dates on public.logistics_plans (starts_on, ends_on);
alter table public.logistics_plans enable row level security;

create table if not exists public.logistics_stations (
  id      uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.logistics_plans(id) on delete cascade,
  name    text not null check (length(btrim(name)) between 1 and 80),
  sort    int  not null default 0
);
create index if not exists logistics_stations_plan on public.logistics_stations (plan_id, sort);
alter table public.logistics_stations enable row level security;

-- A device in a plan. role 'planned' = going to the event; 'backup' = held as a spare, or swapped out (swapped_for says what replaced it, swap_reason why).
create table if not exists public.logistics_plan_devices (
  plan_id     uuid not null references public.logistics_plans(id) on delete cascade,
  device_id   uuid not null references public.logistics_devices(id) on delete cascade,
  station_id  uuid references public.logistics_stations(id) on delete set null,
  role        text not null default 'planned' check (role in ('planned', 'backup')),
  swapped_for uuid references public.logistics_devices(id) on delete set null,
  swap_reason text check (swap_reason is null or length(swap_reason) <= 300),
  added_by    uuid,
  created_at  timestamptz not null default now(),
  primary key (plan_id, device_id)
);
create index if not exists logistics_plan_devices_device on public.logistics_plan_devices (device_id);
alter table public.logistics_plan_devices enable row level security;

-- A step done for a device at an event (who and when). A device not in the plan can still have steps (a backup used on the day).
create table if not exists public.logistics_plan_steps (
  plan_id   uuid not null references public.logistics_plans(id) on delete cascade,
  device_id uuid not null references public.logistics_devices(id) on delete cascade,
  step_id   uuid not null references public.logistics_options(id) on delete restrict,
  done_at   timestamptz not null default now(),
  done_by   uuid,
  primary key (plan_id, device_id, step_id)
);
create index if not exists logistics_plan_steps_plan on public.logistics_plan_steps (plan_id, done_at desc);
alter table public.logistics_plan_steps enable row level security;

-- Starting steps and bundles (all editable in the portal).
insert into public.logistics_options (kind, value, sort, meta) values
  ('step', 'Left Storage',      1, '{"applies":"all"}'),
  ('step', 'Box Returned',      2, '{"applies":"all"}'),
  ('step', 'Check done',        3, '{"applies":"all","kit":true}'),
  ('step', 'Box Taken',         4, '{"applies":"all"}'),
  ('step', 'Back to Storage',   5, '{"applies":"club"}'),
  ('step', 'Returned to owner', 6, '{"applies":"borrowed"}'),
  ('bundle', 'PC Station',      1, '{"items":[{"type":"Gaming PC","qty":1},{"type":"Monitor","qty":1},{"type":"Keyboard","qty":1},{"type":"Mouse","qty":1},{"type":"Headset","qty":1}]}'),
  ('bundle', 'Laptop Station',  2, '{"items":[{"type":"Gaming Laptop","qty":1},{"type":"Mouse","qty":1},{"type":"Headset","qty":1}]}'),
  ('bundle', 'Switch Station',  3, '{"items":[{"type":"Nintendo Switch","qty":1},{"type":"Nintendo Switch Dock","qty":1},{"type":"Switch Pro Controller","qty":1}]}')
on conflict do nothing;

-- Sponsor and officer-loaner devices belong to ONE event, not to the inventory: they are entered inside a plan, with an ID that only has to be unique within that plan.
create table if not exists public.logistics_plan_borrowed (
  id            uuid primary key default gen_random_uuid(),
  plan_id       uuid not null references public.logistics_plans(id) on delete cascade,
  tag           text not null check (length(btrim(tag)) between 1 and 40),
  tag_key       text generated always as (lower(regexp_replace(tag, '\s+', '', 'g'))) stored,
  name          text check (name is null or length(name) <= 120),
  type          text not null check (length(btrim(type)) between 1 and 80),
  owner_kind    text not null check (owner_kind in ('sponsor', 'officer')),
  sponsor_id    uuid references public.logistics_sponsors(id) on delete set null,
  owner_user_id uuid references public.profiles(id) on delete set null,
  owner_note    text check (owner_note is null or length(owner_note) <= 300),
  station_id    uuid references public.logistics_stations(id) on delete set null,
  role          text not null default 'planned' check (role in ('planned', 'backup')),
  swap_reason   text check (swap_reason is null or length(swap_reason) <= 300),
  swapped_for_label text,
  kit           jsonb not null default '[]'::jsonb,
  notes         text check (notes is null or length(notes) <= 1000),
  created_by    uuid,
  created_at    timestamptz not null default now()
);
create unique index if not exists logistics_plan_borrowed_tag on public.logistics_plan_borrowed (plan_id, tag_key);
alter table public.logistics_plan_borrowed enable row level security;

-- A step can be done for a club device or for a borrowed one; a swapped-out device remembers what replaced it as text (the replacement can be either kind).
alter table public.logistics_plan_steps drop constraint if exists logistics_plan_steps_pkey;
alter table public.logistics_plan_steps alter column device_id drop not null;
alter table public.logistics_plan_steps add column if not exists borrowed_id uuid references public.logistics_plan_borrowed(id) on delete cascade;
alter table public.logistics_plan_steps drop constraint if exists logistics_plan_steps_one_item;
alter table public.logistics_plan_steps add constraint logistics_plan_steps_one_item check (num_nonnulls(device_id, borrowed_id) = 1);
create unique index if not exists logistics_plan_steps_device_uniq on public.logistics_plan_steps (plan_id, device_id, step_id) where device_id is not null;
create unique index if not exists logistics_plan_steps_borrowed_uniq on public.logistics_plan_steps (plan_id, borrowed_id, step_id) where borrowed_id is not null;
alter table public.logistics_plan_devices add column if not exists swapped_for_label text;
alter table public.logistics_plan_devices drop column if exists swapped_for;

-- A station is a team's setup: who it is for (the name), a contact, a room (free text) and whether the team has confirmed. Its rows are devices, borrowed devices, or SLOTS: a row
-- allocated by type ("Gaming PC, needs Valorant") that gets a device later (or never, for counted things like a mousepad, where each row is one unit).
alter table public.logistics_stations add column if not exists contact text check (contact is null or length(contact) <= 200);
alter table public.logistics_stations add column if not exists room text check (room is null or length(room) <= 120);
alter table public.logistics_stations add column if not exists confirmed boolean not null default false;

create table if not exists public.logistics_plan_slots (
  id         uuid primary key default gen_random_uuid(),
  plan_id    uuid not null references public.logistics_plans(id) on delete cascade,
  station_id uuid references public.logistics_stations(id) on delete cascade,
  type       text not null check (length(btrim(type)) between 1 and 80),
  games      text[] not null default '{}',
  label      text check (label is null or length(label) <= 120),   -- a note shown with the row, e.g. the Switch a Joy-Con belongs to
  sort       int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists logistics_plan_slots_plan on public.logistics_plan_slots (plan_id, station_id, sort);
alter table public.logistics_plan_slots enable row level security;

-- Which games a row was asked to have ("Downloads needed"), kept when a slot is filled with a device.
alter table public.logistics_plan_devices add column if not exists games_needed text[] not null default '{}';
alter table public.logistics_plan_borrowed add column if not exists games_needed text[] not null default '{}';

alter table public.logistics_plan_steps add column if not exists slot_id uuid references public.logistics_plan_slots(id) on delete cascade;
alter table public.logistics_plan_steps drop constraint if exists logistics_plan_steps_one_item;
alter table public.logistics_plan_steps add constraint logistics_plan_steps_one_item check (num_nonnulls(device_id, borrowed_id, slot_id) = 1);
create unique index if not exists logistics_plan_steps_slot_uniq on public.logistics_plan_steps (plan_id, slot_id, step_id) where slot_id is not null;

-- Two steps before the event steps, as in the old sheet.
do $$
begin
  if not exists (select 1 from public.logistics_options where kind = 'step' and value = 'Condition Checked') then
    update public.logistics_options set sort = sort + 2 where kind = 'step';
    insert into public.logistics_options (kind, value, sort, meta) values
      ('step', 'Condition Checked', 1, '{"applies":"all"}'),
      ('step', 'Sorted', 2, '{"applies":"all"}');
  end if;
end $$;

alter table public.logistics_plan_slots add column if not exists label text check (label is null or length(label) <= 120);

-- Rows keep the order they were planned in (a team's PC, monitor, keyboard, mouse, headset...); anything added by hand later goes after them.
alter table public.logistics_plan_devices add column if not exists sort int not null default 1000;
alter table public.logistics_plan_borrowed add column if not exists sort int not null default 1000;

-- A "set": the rows made together from one bundle (a PC with its monitor, keyboard, mouse and headset) share a set_id, so the screens can show them as one row. No foreign key: it is only a grouping.
alter table public.logistics_plan_devices add column if not exists set_id uuid;
alter table public.logistics_plan_borrowed add column if not exists set_id uuid;
alter table public.logistics_plan_slots add column if not exists set_id uuid;

-- The plan's name in its address (/portal/logistics/plans/<slug>): made when the plan is created and never changed by a rename.
alter table public.logistics_plans add column if not exists slug text;
update public.logistics_plans p set slug = s.slug from (
  select id, case when rn = 1 then base else base || '-' || rn end as slug from (
    select id, base, row_number() over (partition by base order by created_at, id) as rn from (
      select id, created_at, coalesce(nullif(trim(both '-' from lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'))), ''), 'plan') as base from public.logistics_plans where slug is null
    ) a
  ) b
) s where p.id = s.id and p.slug is null;
create unique index if not exists logistics_plans_slug on public.logistics_plans (slug);

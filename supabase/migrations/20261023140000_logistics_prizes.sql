-- Logistics, stage 3: prizes. The prize inventory (club stock and sponsor gifts), the prize pools of an event (a raffle, a team's prizes, a scavenger hunt), what each pool gets,
-- and the event-day steps (in temp storage, sorted, picked up, given out, back to storage) as counts per prize line. Same isolation as the rest: no foreign key to events.

alter table public.logistics_options drop constraint if exists logistics_options_kind_check;
alter table public.logistics_options add constraint logistics_options_kind_check check (kind in ('type', 'shelf', 'tier', 'port', 'game', 'kit', 'step', 'bundle', 'prize_size', 'prize_step'));

create table if not exists public.logistics_prizes (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null check (length(btrim(name)) between 1 and 160),
  sponsor_id          uuid references public.logistics_sponsors(id) on delete set null,
  size                text,                                       -- Small Prizing, Medium Prizing, Free (from the editable list); empty = a big prize
  price               numeric(10, 2) check (price is null or price >= 0),   -- value of one
  quantity            int not null default 0 check (quantity between 0 and 100000),   -- how many there are in all (an estimate when quantity_is_estimate)
  quantity_is_estimate boolean not null default false,
  shelf               text,                                       -- where it is kept in storage (same shelves and tiers as the equipment)
  tier                text,
  place_note          text check (place_note is null or length(place_note) <= 200),
  plan_id             uuid,                                       -- sent for one event (no foreign key); empty = club stock kept in storage
  expires_on          date,
  notes               text check (notes is null or length(notes) <= 2000),
  created_by          uuid,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists logistics_prizes_sponsor on public.logistics_prizes (sponsor_id);
alter table public.logistics_prizes enable row level security;

-- A pool: a place prizes are given from at one event (a raffle, a game's prizes, a scavenger hunt). Optionally linked to one of the plan's teams.
create table if not exists public.logistics_plan_pools (
  id         uuid primary key default gen_random_uuid(),
  plan_id    uuid not null references public.logistics_plans(id) on delete cascade,
  name       text not null check (length(btrim(name)) between 1 and 80),
  station_id uuid references public.logistics_stations(id) on delete set null,
  sort       int not null default 0
);
create index if not exists logistics_plan_pools_plan on public.logistics_plan_pools (plan_id, sort);
alter table public.logistics_plan_pools enable row level security;

-- What a pool gets: this many of this prize.
create table if not exists public.logistics_plan_prizes (
  id       uuid primary key default gen_random_uuid(),
  plan_id  uuid not null references public.logistics_plans(id) on delete cascade,
  pool_id  uuid not null references public.logistics_plan_pools(id) on delete cascade,
  prize_id uuid not null references public.logistics_prizes(id) on delete restrict,
  quantity int not null check (quantity between 1 and 100000),
  sort     int not null default 0,
  unique (pool_id, prize_id)
);
create index if not exists logistics_plan_prizes_plan on public.logistics_plan_prizes (plan_id);
create index if not exists logistics_plan_prizes_prize on public.logistics_plan_prizes (prize_id);
alter table public.logistics_plan_prizes enable row level security;

-- How far each step is for a prize line: a count (sorted 6 of 10), set as a number.
create table if not exists public.logistics_plan_prize_steps (
  line_id    uuid not null references public.logistics_plan_prizes(id) on delete cascade,
  step_id    uuid not null,                                       -- an entry of the 'prize_step' list
  plan_id    uuid not null references public.logistics_plans(id) on delete cascade,
  done       int not null default 0 check (done between 0 and 100000),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  primary key (line_id, step_id)
);
create index if not exists logistics_plan_prize_steps_plan on public.logistics_plan_prize_steps (plan_id, updated_at);
alter table public.logistics_plan_prize_steps enable row level security;

-- The starting lists.
insert into public.logistics_options (kind, value, sort, meta)
select 'prize_step', v.value, v.sort, '{}'::jsonb from (values ('In Temp Storage', 1), ('Sorted', 2), ('Picked Up', 3), ('Given Out', 4), ('Back To Storage', 5)) as v(value, sort)
where not exists (select 1 from public.logistics_options o where o.kind = 'prize_step' and lower(o.value) = lower(v.value));
insert into public.logistics_options (kind, value, sort, meta)
select 'prize_size', v.value, v.sort, '{}'::jsonb from (values ('Free', 1), ('Small Prizing', 2), ('Medium Prizing', 3)) as v(value, sort)
where not exists (select 1 from public.logistics_options o where o.kind = 'prize_size' and lower(o.value) = lower(v.value));

-- Who was on the team in each academic year (exec, leads, officers), built from quarter rosters, plus a setting for moving graduates to Alumni.
-- Server-only tables (RLS on, no policies): the routes and the public Team page read them with the service role.

-- Everyone who held an officer, lead or exec title during a quarter, collected daily while the quarter runs (so someone who leaves mid-quarter is still
-- recorded). tier is the highest title they held in that quarter.
create table if not exists public.quarter_roster (
  quarter_id uuid not null references public.academic_quarters(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  tier       text not null check (tier in ('exec', 'lead', 'officer')),
  title      text,
  name       text not null,
  last_seen  date not null,
  primary key (quarter_id, user_id)
);
alter table public.quarter_roster enable row level security;

-- An academic year's recorded list. start_year 2026 = 2026-27.
create table if not exists public.team_years (
  start_year  int primary key,
  archived_at timestamptz not null default now(),
  archived_by uuid references public.profiles(id) on delete set null,
  auto        boolean not null default true
);
alter table public.team_years enable row level security;

create table if not exists public.team_year_members (
  id         uuid primary key default gen_random_uuid(),
  start_year int not null references public.team_years(start_year) on delete cascade,
  user_id    uuid references public.profiles(id) on delete set null,   -- null for someone added by name for an earlier year
  name       text not null,
  title      text,
  tier       text not null check (tier in ('exec', 'lead', 'officer')),
  avatar_url text,
  manual     boolean not null default false,                          -- added or edited by an admin: kept when the year is rebuilt
  created_at timestamptz not null default now()
);
create unique index if not exists team_year_members_one_per_person on public.team_year_members (start_year, user_id) where user_id is not null;
create index if not exists team_year_members_year on public.team_year_members (start_year);
alter table public.team_year_members enable row level security;

create table if not exists public.team_settings (key text primary key, value text not null);
alter table public.team_settings enable row level security;
-- Moving graduates to Alumni by itself is off until an admin turns it on.
insert into public.team_settings (key, value) values ('auto_alumni', 'off') on conflict (key) do nothing;

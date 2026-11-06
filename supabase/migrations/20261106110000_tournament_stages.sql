-- Tournaments with stages: a tournament is one or more stages played in order (pools then a bracket, Swiss then a top cut). Each stage has its own format and settings, and a rule for who moves on.
-- Entrants of a stage (with their seed and pool) are stored per stage. Matches belong to a stage (and a pool); a points series stores each heat's placements in `heat`.
-- Safe to run once. The tournament tables were empty when this was written.
alter table public.tournaments drop constraint if exists tournaments_format_check;
alter table public.tournaments add constraint tournaments_format_check check (format in ('single', 'double', 'roundrobin', 'swiss', 'points', 'custom', 'multi'));

create table if not exists public.tournament_stages (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  position      int not null check (position >= 1),
  name          text not null default 'Stage',
  format        text not null check (format in ('single', 'double', 'roundrobin', 'swiss', 'points', 'custom')),
  settings      jsonb not null default '{}'::jsonb, -- best_of, third_place, grand_final_reset, swiss_rounds, group_count, seeding, tiebreakers, scoring, points_table, heat_size, rounds
  advance       jsonb not null default '{"mode":"none"}'::jsonb, -- { mode: none | all | top, count, per_group }
  status        text not null default 'pending' check (status in ('pending', 'live', 'complete')),
  created_at    timestamptz not null default now(),
  unique (tournament_id, position)
);
create index if not exists tournament_stages_t_idx on public.tournament_stages (tournament_id, position);

create table if not exists public.tournament_stage_entrants (
  stage_id   uuid not null references public.tournament_stages(id) on delete cascade,
  entrant_id uuid not null references public.tournament_entrants(id) on delete cascade,
  seed       int not null,
  group_no   int,
  primary key (stage_id, entrant_id)
);

alter table public.tournament_matches add column if not exists stage_id uuid references public.tournament_stages(id) on delete cascade;
alter table public.tournament_matches add column if not exists group_no int;
alter table public.tournament_matches add column if not exists label text;
alter table public.tournament_matches add column if not exists best_of int;
alter table public.tournament_matches add column if not exists scheduled_at timestamptz;
alter table public.tournament_matches add column if not exists heat jsonb; -- points series: [{ "entrant_id": "...", "placement": 1, "points": 10 }]
create index if not exists tournament_matches_stage_idx on public.tournament_matches (stage_id);

alter table public.tournament_stages enable row level security;
alter table public.tournament_stage_entrants enable row level security;
drop policy if exists tournament_stages_public_read on public.tournament_stages;
create policy tournament_stages_public_read on public.tournament_stages for select
  using (exists (select 1 from public.tournaments t where t.id = tournament_id and t.is_public and t.status <> 'draft'));

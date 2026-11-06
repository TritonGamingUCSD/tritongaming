-- Tournaments: brackets that update live. A tournament belongs to Triton Gaming (division_id empty) or to a division. Entrants are people with accounts or guests (a name an organizer typed; a guest can claim it later with a code).
-- Organizers, entrants and settings are written by the server only (service role). Matches and the tournament's status can be READ by anyone for a public tournament, so the live page and the stream overlay can listen for changes (Realtime).
-- Additive. Safe to run once.
create table if not exists public.tournaments (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name          text not null,
  game          text not null default '',
  description   text not null default '',
  division_id   uuid references public.divisions(id) on delete set null,
  event_id      uuid references public.events(id) on delete set null,
  format        text not null default 'single' check (format in ('single', 'double', 'roundrobin', 'swiss', 'points')),
  entrant_type  text not null default 'solo' check (entrant_type in ('solo', 'team')),
  team_size     int not null default 2 check (team_size between 2 and 10),
  best_of       int not null default 1 check (best_of in (1, 3, 5, 7)),
  third_place   boolean not null default false,
  swiss_rounds  int,
  max_entrants  int check (max_entrants is null or max_entrants between 2 and 512),
  status        text not null default 'draft' check (status in ('draft', 'registration', 'live', 'complete')),
  is_public     boolean not null default true,
  signups_open  boolean not null default false,
  starts_at     timestamptz,
  overlay_token text not null default encode(gen_random_bytes(12), 'hex'),
  settings      jsonb not null default '{}'::jsonb,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists tournaments_division_idx on public.tournaments (division_id, created_at desc);

create table if not exists public.tournament_entrants (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  user_id       uuid references public.profiles(id) on delete set null,
  name          text not null,
  seed          int,
  checked_in    boolean not null default false,
  dropped       boolean not null default false,
  members       jsonb not null default '[]'::jsonb, -- teams: [{ "user_id": "...", "name": "..." }]
  claim_code    text unique,                         -- a guest entrant is claimed by a signed-in person with this code
  created_at    timestamptz not null default now()
);
create index if not exists tournament_entrants_t_idx on public.tournament_entrants (tournament_id, seed);
create unique index if not exists tournament_entrants_user_uniq on public.tournament_entrants (tournament_id, user_id) where user_id is not null;

create table if not exists public.tournament_staff (
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  primary key (tournament_id, user_id)
);

create table if not exists public.tournament_matches (
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  key           text not null,
  bracket       text not null,
  round         int not null,
  idx           int not null,
  a             text,            -- an entrant id, 'BYE' or empty (not decided yet)
  b             text,
  score_a       int,
  score_b       int,
  winner        text check (winner in ('a', 'b')),
  status        text not null default 'pending' check (status in ('pending', 'ready', 'live', 'done', 'bye', 'skipped')),
  win_to        jsonb,
  lose_to       jsonb,
  games         jsonb not null default '[]'::jsonb, -- per game: { "a": 2, "b": 1, "map": "...", "pick_a": "...", "pick_b": "..." }
  station       text,
  updated_at    timestamptz not null default now(),
  primary key (tournament_id, key)
);

alter table public.tournaments enable row level security;
alter table public.tournament_entrants enable row level security;
alter table public.tournament_staff enable row level security;
alter table public.tournament_matches enable row level security;

drop policy if exists tournaments_public_read on public.tournaments;
create policy tournaments_public_read on public.tournaments for select using (is_public and status <> 'draft');
drop policy if exists tournament_matches_public_read on public.tournament_matches;
create policy tournament_matches_public_read on public.tournament_matches for select
  using (exists (select 1 from public.tournaments t where t.id = tournament_id and t.is_public and t.status <> 'draft'));

do $$ begin
  alter publication supabase_realtime add table public.tournament_matches;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.tournaments;
exception when duplicate_object then null; when undefined_object then null; end $$;

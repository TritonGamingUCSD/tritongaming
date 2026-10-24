-- Trivia: a Kahoot-style quiz game for events. A quiz owns a pool of multiple-choice questions; every time it is hosted a fresh random set is drawn from the pool. Players are signed-in portal members.
-- Everything is read and written through the portal's own routes (service role), so row level security is on with no policies: nothing here is reachable from a browser directly, which is also what keeps
-- the right answers off the phones until the host reveals them.

create table if not exists public.trivia_quizzes (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  name       text not null check (char_length(name) between 1 and 80),
  per_game   int not null default 10 check (per_game between 1 and 100),   -- how many questions a game draws from the pool
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trivia_questions (
  id         uuid primary key default gen_random_uuid(),
  quiz_id    uuid not null references public.trivia_quizzes(id) on delete cascade,
  sort       int not null default 0,
  text       text not null default '' check (char_length(text) <= 300),
  choices    jsonb not null default '["","","",""]'::jsonb,                  -- exactly four answers as typed
  correct    int not null default 0 check (correct between 0 and 3),         -- index into choices
  secs       int not null default 20 check (secs between 5 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists trivia_questions_quiz on public.trivia_questions (quiz_id, sort);

create table if not exists public.trivia_games (
  id           uuid primary key default gen_random_uuid(),
  quiz_id      uuid not null references public.trivia_quizzes(id) on delete cascade,
  code         text not null unique,                                          -- the short join code, also the game's address
  host_id      uuid,
  practice     boolean not null default false,                                -- a practice game saves nothing for good and blocks nobody
  status       text not null default 'lobby' check (status in ('lobby', 'question', 'reveal', 'done')),
  per_game     int not null default 10 check (per_game between 1 and 100),
  plan         jsonb not null default '[]'::jsonb,                            -- the drawn questions, as shown (text, shuffled answers, the right position, seconds)
  current      int not null default -1,
  q_started_at timestamptz,
  q_ends_at    timestamptz,
  reveal       jsonb,                                                         -- what the last reveal (or the final podium) showed
  created_at   timestamptz not null default now(),
  finished_at  timestamptz
);
create index if not exists trivia_games_quiz on public.trivia_games (quiz_id, created_at desc);

create table if not exists public.trivia_players (
  game_id   uuid not null references public.trivia_games(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  name      text not null,
  status    text not null default 'in' check (status in ('in', 'blocked', 'removed')),   -- blocked: a past top 3 of this quiz; removed: sent out by the host. Either can be allowed back in.
  score     int not null default 0,
  time_ms   bigint not null default 0,                                        -- total time spent on right answers (breaks ties)
  joined_at timestamptz not null default now(),
  primary key (game_id, user_id)
);
create index if not exists trivia_players_user on public.trivia_players (user_id);

create table if not exists public.trivia_answers (
  game_id    uuid not null,
  user_id    uuid not null,
  q_index    int not null,
  pos        int not null check (pos between 0 and 3),                        -- the position tapped, as shown on the screen
  ok         boolean not null,
  ms         int not null,
  points     int not null default 0,
  created_at timestamptz not null default now(),
  primary key (game_id, user_id, q_index),
  foreign key (game_id, user_id) references public.trivia_players(game_id, user_id) on delete cascade
);

-- The top 3 of every real (not practice) game: they cannot join a later game of the same quiz unless the host lets them in.
create table if not exists public.trivia_winners (
  game_id uuid not null references public.trivia_games(id) on delete cascade,
  quiz_id uuid not null references public.trivia_quizzes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rank    int not null check (rank between 1 and 3),
  primary key (game_id, user_id)
);
create index if not exists trivia_winners_quiz_user on public.trivia_winners (quiz_id, user_id);

alter table public.trivia_quizzes enable row level security;
alter table public.trivia_questions enable row level security;
alter table public.trivia_games enable row level security;
alter table public.trivia_players enable row level security;
alter table public.trivia_answers enable row level security;
alter table public.trivia_winners enable row level security;

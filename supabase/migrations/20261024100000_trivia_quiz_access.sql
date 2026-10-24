-- A quiz can be shared with only some officers: when `restricted` is on, only its creator, Admins and the people in trivia_quiz_access can open it (questions and answers, hosting, games, results).
-- Everyone else sees only its name with a lock. Players are not affected: anyone with a game's code can still play it.
alter table public.trivia_quizzes add column if not exists restricted boolean not null default false;

create table if not exists public.trivia_quiz_access (
  quiz_id uuid not null references public.trivia_quizzes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  added_by uuid,
  created_at timestamptz not null default now(),
  primary key (quiz_id, user_id)
);
create index if not exists trivia_quiz_access_user on public.trivia_quiz_access (user_id);
alter table public.trivia_quiz_access enable row level security;

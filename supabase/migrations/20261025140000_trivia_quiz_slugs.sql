-- The addresses a quiz had before it was renamed, so old links keep opening it.
create table if not exists public.trivia_quiz_slugs (
  slug    text primary key,
  quiz_id uuid not null references public.trivia_quizzes(id) on delete cascade
);
alter table public.trivia_quiz_slugs enable row level security;

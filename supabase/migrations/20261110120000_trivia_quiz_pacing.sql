-- Trivia pacing, set per quiz: one time limit for every question (null keeps the automatic 40 to 120 seconds by length), asking the questions in the order they are written
-- instead of drawing them at random, and whether a game moves to the next question by itself after an answer is shown (off: the host presses Next).
alter table public.trivia_quizzes
  add column if not exists secs_per_question int check (secs_per_question is null or secs_per_question between 5 and 300),
  add column if not exists shuffle_questions boolean not null default true,
  add column if not exists auto_next boolean not null default true;

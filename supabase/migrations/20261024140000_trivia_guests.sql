-- A quiz can be open to guests: anyone with a game's code can play it on the public /play page with just a nickname (no account). Off by default; the games of a quiz without it are for signed-in members only.
alter table public.trivia_quizzes add column if not exists open_to_guests boolean not null default false;

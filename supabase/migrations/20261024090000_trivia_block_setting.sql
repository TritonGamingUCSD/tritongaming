-- The "top 3 can't play this quiz again" rule becomes a setting of the quiz (on by default), set in the quiz editor, instead of something chosen per game. With it gone from the games, Practice games are
-- removed: every game is kept in the quiz's Games list (and can be deleted); a quiz with the rule switched off simply doesn't hold anyone back or record winners.
alter table public.trivia_quizzes add column if not exists block_winners boolean not null default true;
alter table public.trivia_games drop column if exists practice;

-- The question of the meeting can be typed (anonymous bubbles), a this-or-that poll (2 to 4 options) or a 1 to 5 rating.
alter table public.meetings add column if not exists question_type text not null default 'text' check (question_type in ('text', 'poll', 'rating'));
alter table public.meetings add column if not exists question_options text[];

-- A poll, a Q&A, a Trivia game, a photo booth or a Staffle can be made "for" an event (optional): the event's workspace then lists it, and it can start from there with the event filled in.
-- Nothing changes for what exists: the column is empty until someone picks an event, and deleting an event only clears the link (the tool stays).
-- Additive. Safe to run once.
alter table public.polls add column if not exists event_id uuid references public.events(id) on delete set null;
alter table public.qa_sessions add column if not exists event_id uuid references public.events(id) on delete set null;
alter table public.trivia_games add column if not exists event_id uuid references public.events(id) on delete set null;
alter table public.photobooths add column if not exists event_id uuid references public.events(id) on delete set null;
alter table public.staffles add column if not exists event_id uuid references public.events(id) on delete set null;
create index if not exists polls_event_idx on public.polls (event_id) where event_id is not null;
create index if not exists qa_sessions_event_idx on public.qa_sessions (event_id) where event_id is not null;
create index if not exists trivia_games_event_idx on public.trivia_games (event_id) where event_id is not null;
create index if not exists photobooths_event_idx on public.photobooths (event_id) where event_id is not null;
create index if not exists staffles_event_idx on public.staffles (event_id) where event_id is not null;

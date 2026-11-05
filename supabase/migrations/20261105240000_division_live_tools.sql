-- Live Tools for divisions (step 3 of the division project). Trivia quizzes, polls, Q&A sessions and photo booths can belong to a division (empty: Triton Gaming, every one so far). The routes that read and write
-- them (all server side, through the service role) decide who may touch what from this column: a Triton Gaming officer the club's, a division's Members and Heads their division's, exec and admin everything.
-- Co-hosts: a division that has accepted an invitation to co-host an event may also check that event's tickets in, so the two ticket helpers below look at event_cohosts too.
-- Additive for the data (nothing existing changes meaning). Safe to run once.
alter table public.trivia_quizzes add column if not exists division_id uuid references public.divisions(id) on delete set null;
alter table public.polls add column if not exists division_id uuid references public.divisions(id) on delete set null;
alter table public.qa_sessions add column if not exists division_id uuid references public.divisions(id) on delete set null;
alter table public.photobooths add column if not exists division_id uuid references public.divisions(id) on delete set null;
create index if not exists trivia_quizzes_division_idx on public.trivia_quizzes (division_id) where division_id is not null;
create index if not exists polls_division_idx on public.polls (division_id) where division_id is not null;
create index if not exists qa_sessions_division_idx on public.qa_sessions (division_id) where division_id is not null;
create index if not exists photobooths_division_idx on public.photobooths (division_id) where division_id is not null;

-- A Division Member or Head of the event's owner, or of a division that accepted co-hosting it.
create or replace function public.is_division_member_of_event(_event uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.events e
    where e.id = _event
      and exists (
        select 1 from public.user_roles ur
        where ur.user_id = auth.uid() and ur.role in ('division', 'division_member')
          and (ur.division_id = e.division_id
               or ur.division_id in (select c.division_id from public.event_cohosts c where c.event_id = e.id and c.status = 'accepted' and c.division_id is not null))
      )
  );
$$;

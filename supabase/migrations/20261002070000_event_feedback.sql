-- Post-event feedback: one rating (+ optional comment) per attendee per event.
create table if not exists public.event_feedback (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  rating     smallint not null check (rating between 1 and 5),
  comment    text check (comment is null or char_length(comment) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, user_id)
);

alter table public.event_feedback enable row level security;

-- Only someone who was actually checked in can leave feedback, and only as themselves.
create policy "attendees insert own feedback" on public.event_feedback for insert
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.tickets t where t.event_id = event_feedback.event_id and t.user_id = auth.uid() and t.status = 'used')
  );
create policy "attendees update own feedback" on public.event_feedback for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "feedback readable by owner or staff" on public.event_feedback for select
  using (auth.uid() = user_id or has_capability('checkin'));

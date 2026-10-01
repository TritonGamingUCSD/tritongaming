-- Weekly member meetings (Gen Meeting): an exec opens check-in, people in the room type the
-- rotating code shown on screen. One meeting per title per Pacific day; one attendance row per person.
create table if not exists public.meetings (
  id          uuid primary key default gen_random_uuid(),
  title       text not null default 'Gen Meeting',
  meeting_date date not null,                       -- Pacific calendar day
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  -- HMAC key for the rotating code. Never readable by clients (no select policy).
  code_secret text not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  opened_by   uuid references public.profiles(id) on delete set null,
  closed_at   timestamptz,
  created_at  timestamptz not null default now(),
  unique (title, meeting_date)
);

create table if not exists public.meeting_attendance (
  meeting_id    uuid not null references public.meetings(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  method        text not null default 'code' check (method in ('code', 'manual')),
  added_by      uuid references public.profiles(id) on delete set null,
  primary key (meeting_id, user_id)
);
create index if not exists meeting_attendance_user_idx on public.meeting_attendance (user_id);

alter table public.meetings enable row level security;          -- service role only
alter table public.meeting_attendance enable row level security;
create policy "own meeting attendance readable" on public.meeting_attendance for select using (user_id = auth.uid());
-- All writes and staff reads go through the server (service role).

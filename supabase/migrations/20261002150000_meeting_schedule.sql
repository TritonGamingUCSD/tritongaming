-- Scheduled and repeating meetings. A series ("Gen Meeting, every Friday 5–6 PM") produces one
-- meetings row per day when an exec opens that day's check-in (or skips it).
create table if not exists public.meeting_series (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  weekday     smallint not null check (weekday between 0 and 6),   -- 0 = Sunday, Pacific
  start_time  time not null,                                       -- Pacific wall-clock
  end_time    time not null,
  location    text,
  active      boolean not null default true,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  check (end_time > start_time)
);
alter table public.meeting_series enable row level security;       -- service role only

alter table public.meetings
  add column if not exists series_id uuid references public.meeting_series(id) on delete set null,
  add column if not exists location  text,
  add column if not exists cancelled boolean not null default false;

-- Several different meetings may share a day now; a series only has one per day.
alter table public.meetings drop constraint if exists meetings_title_meeting_date_key;
-- A plain (non-partial) unique index so upserts can target it; one-off meetings have a NULL series_id, which never collides.
create unique index if not exists meetings_series_day_idx on public.meetings (series_id, meeting_date);

-- The example the club asked for: Gen Meeting, every Friday 5–6 PM.
insert into public.meeting_series (title, weekday, start_time, end_time, location)
select 'Gen Meeting', 5, '17:00', '18:00', null
where not exists (select 1 from public.meeting_series where title = 'Gen Meeting');

-- A scheduled meeting only accepts check-ins once an exec has actually opened it.
alter table public.meetings add column if not exists opened_at timestamptz;

-- A link to the meeting's doc (agenda/notes), shown to people after they check in. A series can carry
-- a default link (copied onto each meeting); each meeting's own link can be changed.
alter table public.meeting_series add column if not exists doc_url text;
alter table public.meetings add column if not exists doc_url text;

-- "Question of the meeting": an icebreaker an exec sets per meeting. Checked-in people answer it
-- (one answer each, editable) and send emoji reactions; both show up on the exec's screen.
alter table public.meetings add column if not exists question text;

create table if not exists public.meeting_answers (
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  answer     text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (meeting_id, user_id)
);
create table if not exists public.meeting_reactions (
  id         bigint generated always as identity primary key,
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  emoji      text not null,
  created_at timestamptz not null default now()
);
create index if not exists meeting_reactions_meeting_idx on public.meeting_reactions (meeting_id, id);
alter table public.meeting_answers enable row level security;     -- service role only
alter table public.meeting_reactions enable row level security;   -- service role only

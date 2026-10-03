-- Meeting plans: "find a time" polls for meetings that are not scheduled yet. A plan is either one-time (a date range up to
-- 14 days) or weekly (Sunday to Saturday). People mark each 30-minute slot available / if needed (anything unmarked is
-- unavailable), per plan, nothing carries over. When the host picks a time the plan becomes a real meeting (or weekly series).
create table if not exists public.meeting_plans (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null check (kind in ('once', 'weekly')),
  title         text not null,
  description   text,
  location      text,
  duration_min  integer not null check (duration_min between 30 and 480 and duration_min % 30 = 0),
  window_start  time not null default '09:00',   -- first slot shown each day (Pacific)
  window_end    time not null default '22:00',   -- the grid ends here (the last slot ends at this time)
  range_start   date,                            -- one-time plans only
  range_end     date,
  answer_by     date,
  audience      text[],
  invitees      uuid[],
  group_ids     uuid[],
  status        text not null default 'open' check (status in ('open', 'decided')),
  meeting_id    uuid references public.meetings(id) on delete set null,
  series_id     uuid references public.meeting_series(id) on delete set null,
  decided_slot  jsonb,                           -- { day | weekday, start }
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  reminded_at   timestamptz,
  check (window_end > window_start),
  check (kind <> 'once' or (range_start is not null and range_end is not null and range_end >= range_start and range_end - range_start <= 13))
);
alter table public.meeting_plans enable row level security;       -- service role only

-- One row per person per plan. slots: { "<YYYY-MM-DD or weekday 0-6>": { "<HH:MM>": 1 (available) | 2 (if needed) } }
create table if not exists public.meeting_plan_responses (
  plan_id      uuid not null references public.meeting_plans(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  slots        jsonb not null default '{}'::jsonb,
  responded_at timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (plan_id, user_id)
);
alter table public.meeting_plan_responses enable row level security;

-- Absences created automatically when a plan's time was picked (so reopening the plan can take them back off).
alter table public.meeting_absences add column if not exists plan_id uuid references public.meeting_plans(id) on delete cascade;

-- For a weekly plan: people who can't make the chosen weekly time. Copied onto each occurrence when it is created.
create table if not exists public.meeting_series_absences (
  series_id uuid not null references public.meeting_series(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  reason    text,
  excused   boolean not null default true,
  plan_id   uuid references public.meeting_plans(id) on delete cascade,
  primary key (series_id, user_id)
);
alter table public.meeting_series_absences enable row level security;

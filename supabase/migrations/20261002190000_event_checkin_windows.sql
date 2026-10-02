-- Per-day check-in hours for multi-day events: [{ "day": "2026-11-07", "start": "10:00", "end": "18:00" }]
-- (Pacific time). A day with no entry stays open all day, like before.
alter table public.events
  add column if not exists checkin_windows jsonb not null default '[]'::jsonb;

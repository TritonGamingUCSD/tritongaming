-- The hours of each day of a multi-day event: [{ "day": "2026-10-10", "start": "17:00", "end": "21:00" }, ...] in Pacific time. These are the event's own hours (shown on the
-- public page, and the overall start and end come from them). They are separate from checkin_windows, which only limits the staff scanner.
alter table public.events add column if not exists day_hours jsonb not null default '[]'::jsonb;

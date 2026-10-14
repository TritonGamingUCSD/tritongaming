-- The "private" flag only kept a meeting off the "All TG meetings" view of the portal calendar, which was removed with the calendar.
alter table public.meetings drop column if exists is_private;
alter table public.meeting_series drop column if exists is_private;

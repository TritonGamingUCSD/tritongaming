-- The last day a weekly meeting happens (blank = it keeps going). After it, the meeting stops showing up in the portal, the portal
-- calendar and calendar subscriptions.
alter table public.meeting_series add column if not exists ends_on date;

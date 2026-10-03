-- When the host last sent a manual "remind people" for a plan (limits how often it can be sent).
alter table public.meeting_plans add column if not exists nudged_at timestamptz;

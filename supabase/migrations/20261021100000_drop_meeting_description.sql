-- Nobody used the optional "what's this meeting about" line, so it is gone from meetings, repeating meetings and meeting plans.
-- (Backup taken first: backups/2026-10-18/.)
alter table public.meetings drop column if exists description;
alter table public.meeting_series drop column if exists description;
alter table public.meeting_plans drop column if exists description;

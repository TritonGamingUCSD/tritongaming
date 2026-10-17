-- Any officer or recruit (and leads and exec) may check in to a meeting they were not added to, unless the host turns it off for that meeting.
-- On for every meeting, including the ones that already exist.
alter table public.meetings       add column if not exists open_to_team boolean not null default true;
alter table public.meeting_series add column if not exists open_to_team boolean not null default true;

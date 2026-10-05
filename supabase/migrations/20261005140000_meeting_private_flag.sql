-- A host can mark a meeting (or a repeating series) private: it still shows on the calendar of the people it is
-- meant for, but is left out of the "All TG meetings" calendar view that every member can switch to.
alter table public.meetings add column if not exists is_private boolean not null default false;
alter table public.meeting_series add column if not exists is_private boolean not null default false;

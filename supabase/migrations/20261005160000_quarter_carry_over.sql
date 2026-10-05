-- Quarter status: a new quarter starts as a copy of the last quarter's inactive list, and future quarters can't be planned.
-- carried_over_at: set once, the day the quarter starts and the copy is made. Quarters that have already started are marked done so nothing changes for them.
alter table public.academic_quarters add column if not exists carried_over_at timestamptz;
update public.academic_quarters set carried_over_at = now() where carried_over_at is null and starts_on <= (now() at time zone 'America/Los_Angeles')::date;
-- Nobody should know in advance who is inactive in a quarter that has not started: drop any marks already set for the future.
delete from public.officer_quarter_status s using public.academic_quarters q
  where s.quarter_id = q.id and q.starts_on > (now() at time zone 'America/Los_Angeles')::date;

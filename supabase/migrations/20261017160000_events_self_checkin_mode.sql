-- Self check-in has three settings instead of on/off: off, on until the event ends, or on with no end. Every event stays 'off' unless it was already turned on
-- (that becomes 'until_end', the old behavior). The old self_checkin_enabled column is left in place and unused for now, so code still running from before
-- this change keeps working; it is dropped in a later migration once nothing reads it.
alter table public.events add column if not exists self_checkin_mode text not null default 'off' check (self_checkin_mode in ('off', 'until_end', 'forever'));
update public.events set self_checkin_mode = 'until_end' where self_checkin_enabled and self_checkin_mode = 'off';

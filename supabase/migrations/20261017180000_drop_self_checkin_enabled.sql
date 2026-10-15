-- Replaced by self_checkin_mode (off / until_end / forever); nothing reads this any more.
alter table public.events drop column if exists self_checkin_enabled;

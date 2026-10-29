-- Columns that no code and no SQL function reads any more (found by scanning every source file and migration). NOT applied yet: run `npm run backup:db` first, then apply.
-- Each column is only dropped if it exists, so running this twice is harmless.

alter table if exists public.profiles drop column if exists leaderboard_show_name;           -- the leaderboard was simplified (20260922120000); nothing reads the old name toggle
alter table if exists public.meeting_plan_responses drop column if exists responded_at;      -- written once, never shown or sorted on
alter table if exists public.strike_vouchers drop column if exists used_by;                  -- never read; a voucher's use is tracked another way
alter table if exists public.strike_dismissals drop column if exists dismissed_at;           -- never read

-- Left in on purpose (an audit trail of who asked for and who decided a strike-setting change; unused by the app today but cheap to keep):
--   strike_settings.requested_by, decided_by, decided_at, decision_note

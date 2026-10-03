-- Why a missed meeting was dismissed (optional), shown in "Past missed meetings".
alter table public.strike_dismissals add column if not exists reason text;

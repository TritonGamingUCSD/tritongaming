-- A reset (usually once a quarter) clears everyone's active strikes. They stay on record as removed, with the reason.
alter table public.strikes drop constraint if exists strikes_removed_how_check;
alter table public.strikes add constraint strikes_removed_how_check check (removed_how in ('taken', 'voucher', 'reset'));
alter table public.strike_events drop constraint if exists strike_events_kind_check;
alter table public.strike_events add constraint strike_events_kind_check check (kind in ('strike_added', 'strike_removed', 'strike_reinstated', 'voucher_given', 'voucher_used', 'voucher_removed', 'strikes_reset'));

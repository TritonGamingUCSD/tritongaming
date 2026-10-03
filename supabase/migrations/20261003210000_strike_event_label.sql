-- Which mark an added strike was ("Warning", "Strike 2"), so the history reads "Warning added" rather than "Strike added".
alter table public.strike_events add column if not exists label text;

-- "Draw again" is gone: a winner is never passed over. Any passed-over rows go (their replacement stays), then the column.
delete from public.staffle_winners where passed_at is not null;
alter table public.staffle_winners drop column if exists passed_at;

-- Events no longer have a capacity limit. No event had one set when this was written. Run it only after the code that stopped reading the column is live,
-- because the live site and the test site share this database.
alter table public.events drop column if exists max_capacity;

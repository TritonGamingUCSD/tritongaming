-- Events are no longer tagged with a division (the picker was removed from the event form). No event had one set when this was written.
-- Run it only after the code that stopped reading the column is live, because the live site and the test site share this database.
drop index if exists public.events_division_id_idx;
alter table public.events drop column if exists division_id;

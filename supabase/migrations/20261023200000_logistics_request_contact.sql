-- The main contact for a request (who to reach on the day); it is written onto the request's team so every page shows the same one.
alter table public.logistics_requests add column if not exists contact text check (contact is null or length(contact) <= 200);

-- The "Confirmed" mark on a team was removed from Logistics; nothing reads this column any more.
alter table public.logistics_stations drop column if exists confirmed;

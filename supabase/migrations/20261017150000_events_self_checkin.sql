-- Self check-in: staff can switch it on per event. Off for every event until someone turns it on, so staff scanning is unchanged.
alter table public.events add column if not exists self_checkin_enabled boolean not null default false;

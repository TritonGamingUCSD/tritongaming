-- Which line of a request a row came from (the bundle or device type it was asked as), so a request can add or remove whole bundle sets.
alter table public.logistics_plan_slots add column if not exists request_item text;
alter table public.logistics_plan_devices add column if not exists request_item text;

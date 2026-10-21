-- Rows in an event's allocation come from a device request: remember which request made a row, so editing the request adds or removes the empty rows and the request can show how many are filled.
alter table public.logistics_plan_slots add column if not exists request_id uuid;
alter table public.logistics_plan_devices add column if not exists request_id uuid;
create index if not exists logistics_plan_slots_request on public.logistics_plan_slots (request_id) where request_id is not null;
create index if not exists logistics_plan_devices_request on public.logistics_plan_devices (request_id) where request_id is not null;

-- The inventory is the club's own devices only: sponsor and officer-loaner devices are entered inside one event's plan (logistics_plan_borrowed). Remove the owner fields the first
-- version of the catalog had. Applied after the code that no longer reads them was live, so the site never asked for a column that was gone.
alter table public.logistics_devices drop column if exists owner_type;
alter table public.logistics_devices drop column if exists owner_user_id;
alter table public.logistics_devices drop column if exists sponsor_id;
alter table public.logistics_devices drop column if exists owner_note;

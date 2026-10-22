-- The games installed on a sponsor or officer loaner, so the sheet can tell whether it already has what a row needs.
alter table public.logistics_plan_borrowed add column if not exists games text[] not null default '{}';

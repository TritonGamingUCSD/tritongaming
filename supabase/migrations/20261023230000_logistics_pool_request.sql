-- A prize request makes a pool for its team: how many prizes it asked for and the dollar total (count x value), so the allocation can show progress and suggest prizes.
alter table public.logistics_plan_pools add column if not exists request_id uuid;
alter table public.logistics_plan_pools add column if not exists target_qty int;
alter table public.logistics_plan_pools add column if not exists target_total numeric(10,2);
create index if not exists logistics_plan_pools_request on public.logistics_plan_pools (request_id) where request_id is not null;

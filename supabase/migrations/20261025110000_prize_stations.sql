-- Prizing, step 2 of the redesign: one "station" for a team's devices AND prizes. Prize pools are gone: a prize line belongs to a station, and what a prize request asked for (and the size
-- counts) sits on the station. A station made only for prizes (a raffle, a scavenger hunt) is marked prize_only; the Devices page leaves such a station out until it has devices.

alter table public.logistics_stations add column if not exists prize_only boolean not null default false;
alter table public.logistics_stations add column if not exists prize_request_id uuid;
alter table public.logistics_stations add column if not exists prize_target_qty int;
alter table public.logistics_stations add column if not exists prize_target_sizes jsonb;
alter table public.logistics_stations add column if not exists pool_tmp uuid;   -- only while this migration runs

-- A pool linked to a team uses that team's station; every other pool becomes a station of its own (same name, same order, after the existing ones).
update public.logistics_plan_pools p set station_id = s.id
from public.logistics_stations s
where p.station_id is null and s.plan_id = p.plan_id and lower(s.name) = lower(p.name) and s.pool_tmp is null;

insert into public.logistics_stations (plan_id, name, sort, prize_only, pool_tmp)
select p.plan_id, p.name, coalesce((select max(s.sort) from public.logistics_stations s where s.plan_id = p.plan_id), 0) + p.sort, true, p.id
from public.logistics_plan_pools p where p.station_id is null;

update public.logistics_plan_pools p set station_id = s.id
from public.logistics_stations s where s.pool_tmp = p.id and p.station_id is null;

-- What the prize request asked for moves onto the station.
update public.logistics_stations s set prize_request_id = p.request_id, prize_target_qty = p.target_qty, prize_target_sizes = p.target_sizes
from public.logistics_plan_pools p where p.station_id = s.id and p.request_id is not null;

-- Prize lines hang off stations.
alter table public.logistics_plan_prizes add column if not exists station_id uuid references public.logistics_stations(id) on delete cascade;
update public.logistics_plan_prizes l set station_id = p.station_id from public.logistics_plan_pools p where p.id = l.pool_id;
alter table public.logistics_plan_prizes alter column station_id set not null;
alter table public.logistics_plan_prizes drop constraint if exists logistics_plan_prizes_pool_id_prize_id_key;
alter table public.logistics_plan_prizes drop column pool_id;
create unique index if not exists logistics_plan_prizes_station_prize on public.logistics_plan_prizes (station_id, prize_id);
create index if not exists logistics_plan_prizes_station on public.logistics_plan_prizes (station_id);

drop table public.logistics_plan_pools;
alter table public.logistics_stations drop column pool_tmp;
create index if not exists logistics_stations_prize_request on public.logistics_stations (prize_request_id) where prize_request_id is not null;

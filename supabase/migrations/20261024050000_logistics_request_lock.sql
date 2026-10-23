-- A request's allocation can be locked so nothing in it (its device rows, its prize pool, its amounts) is changed by accident. Only Event Logistics can lock or unlock.
alter table public.logistics_requests add column if not exists allocation_locked boolean not null default false;

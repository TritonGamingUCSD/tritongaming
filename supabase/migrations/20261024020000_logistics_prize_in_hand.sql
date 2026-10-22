-- Whether a prize is physically here yet. Club stock is; a sponsor prize sent for an event starts as "not here yet" until someone ticks it.
alter table public.logistics_prizes add column if not exists in_hand boolean not null default true;

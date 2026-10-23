-- Prizes kept for future events. Closing an event no longer puts what wasn't given out back in stock by itself: for events made from now on (manual_return) a prize is only back in stock once it was put
-- on the event's Keep list and then moved to inventory by hand. Events that were already closed keep the old behaviour (what was not given out counts as back in stock).
alter table public.logistics_plans add column if not exists manual_return boolean not null default true;
update public.logistics_plans set manual_return = false where status = 'closed';

create table if not exists public.logistics_plan_keeps (
  plan_id    uuid not null references public.logistics_plans(id) on delete cascade,
  prize_id   uuid not null references public.logistics_prizes(id) on delete restrict,
  quantity   int not null check (quantity between 1 and 100000),
  moved_at   timestamptz,                    -- set when it was moved to inventory, which is what puts it back in stock
  moved_by   uuid,
  added_by   uuid,
  created_at timestamptz not null default now(),
  primary key (plan_id, prize_id)
);
create index if not exists logistics_plan_keeps_prize on public.logistics_plan_keeps (prize_id);
alter table public.logistics_plan_keeps enable row level security;

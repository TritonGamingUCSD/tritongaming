-- Prizing, step 1 of the redesign: a stock history, "in stock" as the real count on hand, a plain bin name, and no more Keep list.
--
-- Until now a prize's quantity was "how many there ever were" and what had been given out was worked out from the event-day counts of every event (and, for events closed by hand, from a Keep list).
-- Now quantity is how many are on hand. A prize given out lowers it when it happens, an event that closes lowers it by what was taken out and not counted back, and everything else that was
-- promised to a closed event simply counts as free again. This turns the old quantity into the new one so that "left" stays exactly what it was: new quantity = old quantity - old given.

create table if not exists public.logistics_prize_log (
  id         uuid primary key default gen_random_uuid(),
  prize_id   uuid not null references public.logistics_prizes(id) on delete cascade,
  kind       text not null check (kind in ('add', 'correct', 'assign', 'give')),   -- stock added / count set by hand / promised to (or taken back from) a station / given out
  qty        int  not null,                                                       -- add, correct, give: the change in stock (give is negative). assign: how many more are promised (negative = fewer)
  plan_id    uuid,                                                                -- no foreign keys below: the history outlives the event, the station and the sponsor
  plan_name  text,
  station    text,
  sponsor_id uuid,
  note       text check (note is null or length(note) <= 300),
  ref        text,                                                                -- 'close' for what closing an event took out of stock (undone when the event is reopened)
  actor      uuid,
  at         timestamptz not null default now()
);
create index if not exists logistics_prize_log_prize on public.logistics_prize_log (prize_id, at desc);
create index if not exists logistics_prize_log_plan on public.logistics_prize_log (plan_id, ref) where ref is not null;
alter table public.logistics_prize_log enable row level security;

-- A rough place in storage ("Blue bin 2") and where it came from (a sponsor is linked separately; this is for "bought at Costco").
alter table public.logistics_prizes add column if not exists bin text check (bin is null or length(bin) <= 120);
alter table public.logistics_prizes add column if not exists source text check (source is null or length(source) <= 200);
update public.logistics_prizes set bin = nullif(btrim(concat_ws(' · ', shelf, tier, place_note)), '') where bin is null;

-- Quantity becomes "on hand" (one statement, so it does not depend on a temporary table surviving between statements).
with lines as (
  select l.id, l.plan_id, l.prize_id, l.quantity,
    coalesce((select sum(s.done) from public.logistics_plan_prize_steps s
              join public.logistics_options o on o.id = s.step_id and o.kind = 'prize_step' and coalesce((o.meta->>'gives')::boolean, false)
              where s.line_id = l.id), 0) as gv
  from public.logistics_plan_prizes l
), per as (
  select plan_id, prize_id, sum(quantity) q, sum(least(gv, quantity)) g from lines group by 1, 2
), used as (
  select per.prize_id,
    sum(case when pl.status = 'draft' then per.g
             when not coalesce(pl.manual_return, false) then per.g
             else per.q - least(greatest(0, coalesce(k.quantity, 0)), greatest(0, per.q - per.g)) end)::int as given
  from per
  join public.logistics_plans pl on pl.id = per.plan_id
  left join public.logistics_plan_keeps k on k.plan_id = per.plan_id and k.prize_id = per.prize_id and k.moved_at is not null
  group by per.prize_id
)
update public.logistics_prizes p set quantity = greatest(0, p.quantity - u.given)
from used u where u.prize_id = p.id and u.given > 0;

-- The history starts with the count each prize has now.
insert into public.logistics_prize_log (prize_id, kind, qty, note)
select id, 'correct', quantity, 'Count when the stock history began' from public.logistics_prizes;

-- The Keep list is gone (what is not given out is back in stock when an event closes), and so is "sent for one event" and the separate shelf, tier and spot.
drop table if exists public.logistics_plan_keeps;
alter table public.logistics_plans drop column if exists manual_return;
alter table public.logistics_prizes drop column if exists plan_id;
alter table public.logistics_prizes drop column if exists shelf;
alter table public.logistics_prizes drop column if exists tier;
alter table public.logistics_prizes drop column if exists place_note;

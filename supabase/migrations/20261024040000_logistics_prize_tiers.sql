-- Prizing is planned by size tier (Free / Small / Medium / Large Prizing) instead of dollars. A prize with no size was a "big prize", so it becomes Large Prizing; a prize request asks for
-- how many of each size; a pool keeps those counts in target_sizes (target_qty stays the total). Old dollar requests are turned into a tier by value: under $10 Free, under $45 Small, under $100
-- Medium, above Large. The pool's dollar total is dropped.
insert into public.logistics_options (kind, value, sort, meta)
select 'prize_size', 'Large Prizing', 4, '{}'::jsonb
where not exists (select 1 from public.logistics_options o where o.kind = 'prize_size' and lower(o.value) = 'large prizing');

update public.logistics_prizes set size = 'Large Prizing' where size is null;

alter table public.logistics_plan_pools add column if not exists target_sizes jsonb;

update public.logistics_requests r set items = (
  select coalesce(jsonb_agg(
    case when i ? 'value' then jsonb_build_object('qty', i->'qty', 'size',
      case when (i->>'value')::numeric < 10 then 'Free' when (i->>'value')::numeric < 45 then 'Small Prizing' when (i->>'value')::numeric < 100 then 'Medium Prizing' else 'Large Prizing' end)
    else i end), '[]'::jsonb)
  from jsonb_array_elements(r.items) i)
where r.kind = 'prizes';

update public.logistics_plan_pools p set target_sizes = t.sizes
from (
  select r.id, (select jsonb_object_agg(s, q) from (select i->>'size' as s, sum((i->>'qty')::int) as q from jsonb_array_elements(r.items) i group by 1) x) as sizes
  from public.logistics_requests r where r.kind = 'prizes'
) t
where p.request_id = t.id;

alter table public.logistics_plan_pools drop column if exists target_total;

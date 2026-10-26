-- Prizing, working together: who last changed a number (so a clash can say "Sam just changed this from 3 to 5"), and a counter that adds up when two phones tap at the same moment.

alter table public.logistics_plan_prizes add column if not exists updated_by uuid;
alter table public.logistics_plan_prizes add column if not exists updated_at timestamptz not null default now();
alter table public.logistics_prizes add column if not exists updated_by uuid;

-- Adds `p_delta` to one prize line's count for one step, in one statement, so two taps at once are both counted. The count stays between 0 and the cap the caller worked out (how many the line
-- has, or how many were not given out). Returns the count before and after, so the caller can tell what really changed (a "gives" step takes stock out by exactly that).
create or replace function public.logistics_prize_step_add(p_line uuid, p_step uuid, p_plan uuid, p_delta int, p_cap int, p_user uuid)
returns table (old_done int, new_done int)
language plpgsql
security definer
set search_path = public
as $$
declare old_v int; new_v int;
begin
  insert into public.logistics_plan_prize_steps (line_id, step_id, plan_id, done, updated_at, updated_by)
  values (p_line, p_step, p_plan, 0, now(), p_user)
  on conflict (line_id, step_id) do nothing;
  select done into old_v from public.logistics_plan_prize_steps where line_id = p_line and step_id = p_step for update;
  new_v := least(greatest(old_v + p_delta, 0), greatest(p_cap, 0));
  update public.logistics_plan_prize_steps set done = new_v, updated_at = now(), updated_by = p_user where line_id = p_line and step_id = p_step;
  return query select old_v, new_v;
end;
$$;
revoke all on function public.logistics_prize_step_add(uuid, uuid, uuid, int, int, uuid) from public, anon, authenticated;

-- Mirrors admin_award_officer_points (20260921100000_add_officer_points_system.sql)
-- on the member ledger: award the same amount to one or more members at
-- once, so the portal's Award Points tool can offer the same
-- search-and-add-multiple-targets flow the Battlepass side already has,
-- instead of member points being stuck with admin_adjust_points'
-- one-target-at-a-time shape. admin_adjust_points itself is left in place
-- (still reachable via /api/admin/points/adjust) rather than dropped —
-- this is additive, not a replacement at the database layer.

begin;

create or replace function public.admin_award_points(_user_ids uuid[], _amount integer, _note text, _admin_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if _amount = 0 then
    raise exception 'Award amount can''t be zero.';
  end if;
  if _user_ids is null or array_length(_user_ids, 1) is null then
    raise exception 'At least one member must be selected.';
  end if;

  insert into public.point_transactions (user_id, amount, type, note, created_by)
  select u, _amount, 'admin_adjustment', _note, _admin_id from unnest(_user_ids) as u;
end;
$$;

revoke all on function public.admin_award_points(uuid[], integer, text, uuid) from public, anon, authenticated;

commit;

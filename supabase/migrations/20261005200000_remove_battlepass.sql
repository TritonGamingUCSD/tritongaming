-- Removes the officer Battlepass system. Member Rewards/Points and member
-- tier_definitions are untouched. The two functions that referenced the
-- officer tables are re-created first, then the officer functions/tables
-- and the system='officer' tier rows are dropped.

begin;

create or replace function public.admin_delete_account(_user_id uuid, _admin_id uuid, _reassign_to uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if _user_id = _admin_id then
    raise exception 'You cannot delete your own account this way.';
  end if;
  if _reassign_to is not null and _reassign_to = _user_id then
    raise exception 'Cannot merge an account into itself.';
  end if;
  if not exists (select 1 from public.profiles where id = _user_id) then
    raise exception 'Account not found.';
  end if;
  if _reassign_to is not null and not exists (select 1 from public.profiles where id = _reassign_to) then
    raise exception 'The account to merge into was not found.';
  end if;

  -- A plain delete (no merge target) that would remove the last admin
  -- would lock everyone out of Member Management — refuse it outright.
  if _reassign_to is null
    and exists (select 1 from public.user_roles where user_id = _user_id and role = 'admin')
    and (select count(*) from public.user_roles where role = 'admin') <= 1
  then
    raise exception 'Cannot delete the only remaining admin account.';
  end if;

  -- NO ACTION attribution columns — reassign on merge, null on plain delete.
  update public.events set created_by = _reassign_to where created_by = _user_id;
  update public.photo_albums set created_by = _reassign_to where created_by = _user_id;
  update public.point_transactions set created_by = _reassign_to where created_by = _user_id;
  update public.reward_items set created_by = _reassign_to where created_by = _user_id;
  update public.reward_redemptions set cancelled_by = _reassign_to where cancelled_by = _user_id;
  update public.reward_redemptions set fulfilled_by = _reassign_to where fulfilled_by = _user_id;
  update public.role_change_log set changed_by = _reassign_to where changed_by = _user_id;
  update public.site_contents set updated_by = _reassign_to where updated_by = _user_id;
  update public.tickets set checked_in_by = _reassign_to where checked_in_by = _user_id;
  update public.user_roles set granted_by = _reassign_to where granted_by = _user_id;

  if _reassign_to is not null then
    update public.user_roles set user_id = _reassign_to
      where user_id = _user_id
        and not exists (select 1 from public.user_roles ur2 where ur2.user_id = _reassign_to and ur2.role = user_roles.role);
    delete from public.user_roles where user_id = _user_id;

    update public.tickets set user_id = _reassign_to where user_id = _user_id;
    update public.notifications set user_id = _reassign_to where user_id = _user_id;
    update public.role_change_log set user_id = _reassign_to where user_id = _user_id;
    update public.reward_redemptions set user_id = _reassign_to where user_id = _user_id;

    update public.point_transactions set user_id = _reassign_to where user_id = _user_id;
    update public.point_transactions set related_user_id = _reassign_to
      where related_user_id = _user_id
        and not (type = 'referral_bonus' and reversed_at is null and exists (
          select 1 from public.point_transactions pt2
          where pt2.related_user_id = _reassign_to and pt2.type = 'referral_bonus' and pt2.reversed_at is null
        ));

    update public.docs set created_by = _reassign_to where created_by = _user_id;
    update public.docs set updated_by = _reassign_to where updated_by = _user_id;
    update public.profiles set referred_by = _reassign_to where referred_by = _user_id;
  end if;

  delete from public.profiles where id = _user_id;
end;
$$;

revoke all on function public.admin_delete_account(uuid, uuid, uuid) from public, anon, authenticated;


revoke all on function public.admin_delete_account(uuid, uuid, uuid) from public, anon, authenticated;

create or replace function public.get_admin_activity(_admin_id uuid, _limit integer default 30)
returns table(action text, detail text, occurred_at timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  select action, detail, occurred_at from (
    select 'Changed roles' as action,
      'for ' || coalesce(p.display_name, 'someone') as detail,
      rcl.created_at as occurred_at
    from public.role_change_log rcl
    left join public.profiles p on p.id = rcl.user_id
    where rcl.changed_by = _admin_id

    union all
    select 'Points adjustment',
      (case when pt.amount >= 0 then '+' else '' end) || pt.amount || ' pts for ' || coalesce(p.display_name, 'someone')
        || case when pt.note is not null and pt.note <> '' then ' — ' || pt.note else '' end,
      pt.created_at
    from public.point_transactions pt
    left join public.profiles p on p.id = pt.user_id
    where pt.created_by = _admin_id

    union all
    select case when rr.fulfilled_by = _admin_id then 'Fulfilled reward' else 'Cancelled reward' end,
      coalesce(ri.title, 'a reward') || ' for ' || coalesce(p.display_name, 'someone'),
      coalesce(rr.fulfilled_at, rr.cancelled_at)
    from public.reward_redemptions rr
    left join public.reward_items ri on ri.id = rr.reward_id
    left join public.profiles p on p.id = rr.user_id
    where rr.fulfilled_by = _admin_id or rr.cancelled_by = _admin_id

    union all
    select 'Added shop item', ri.title, ri.created_at
    from public.reward_items ri
    where ri.created_by = _admin_id

    union all
    select 'Created event', e.title, e.created_at
    from public.events e
    where e.created_by = _admin_id

    union all
    select 'Created doc', d.title, d.created_at
    from public.docs d
    where d.created_by = _admin_id

    union all
    select 'Edited doc', d.title, d.updated_at
    from public.docs d
    where d.updated_by = _admin_id and d.updated_at <> d.created_at

    union all
    select 'Added photo album', pa.title, pa.created_at
    from public.photo_albums pa
    where pa.created_by = _admin_id
  ) feed
  where occurred_at is not null
  order by occurred_at desc
  limit _limit;
$$;

revoke all on function public.get_admin_activity(uuid, integer) from public, anon, authenticated;


revoke all on function public.get_admin_activity(uuid, integer) from public, anon, authenticated;

drop function if exists public.admin_award_officer_points;
drop function if exists public.cancel_officer_redemption;
drop function if exists public.claim_officer_reward;
drop function if exists public.confirm_officer_redemption;
drop function if exists public.reverse_officer_point_transaction;

drop table if exists public.officer_reward_redemptions cascade;
drop table if exists public.officer_reward_items cascade;
drop table if exists public.officer_point_transactions cascade;

delete from public.tier_definitions where system = 'officer';

commit;

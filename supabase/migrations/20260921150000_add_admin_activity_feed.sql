-- "What has this admin done lately" — no single table tracks this (see
-- role_change_log, the only dedicated audit table, which is role-changes
-- only). Rather than adding a new audit_log table + triggers on every
-- mutation site, this unions the `_by` columns that already exist across
-- the tables an admin actually acts on (role_change_log.changed_by,
-- point/officer_point_transactions.created_by, reward/officer_reward
-- redemptions' fulfilled_by/cancelled_by, reward/officer_reward
-- items.created_by, events.created_by, docs.created_by/updated_by,
-- photo_albums.created_by) into one feed, newest first. Deliberately a
-- read-only aggregation function, not a new table — nothing to keep in
-- sync, and every source it reads is already the authoritative record of
-- that action.
--
-- tier_definitions edits are NOT included — that table has no attribution
-- column at all (admin_upsert_tier/admin_delete_tier don't record who
-- called them), so a tier change currently can't be traced to an admin.
-- Not fixed here; flagging it as a known gap rather than silently
-- pretending this feed is exhaustive.

begin;

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
    select 'Battlepass award',
      (case when opt.amount >= 0 then '+' else '' end) || opt.amount || ' pts for ' || coalesce(p.display_name, 'someone')
        || case when opt.note is not null and opt.note <> '' then ' — ' || opt.note else '' end,
      opt.created_at
    from public.officer_point_transactions opt
    left join public.profiles p on p.id = opt.user_id
    where opt.created_by = _admin_id

    union all
    select case when rr.fulfilled_by = _admin_id then 'Fulfilled reward' else 'Cancelled reward' end,
      coalesce(ri.title, 'a reward') || ' for ' || coalesce(p.display_name, 'someone'),
      coalesce(rr.fulfilled_at, rr.cancelled_at)
    from public.reward_redemptions rr
    left join public.reward_items ri on ri.id = rr.reward_id
    left join public.profiles p on p.id = rr.user_id
    where rr.fulfilled_by = _admin_id or rr.cancelled_by = _admin_id

    union all
    select case when orr.fulfilled_by = _admin_id then 'Fulfilled Battlepass reward' else 'Cancelled Battlepass reward' end,
      coalesce(ori.title, 'a reward') || ' for ' || coalesce(p.display_name, 'someone'),
      coalesce(orr.fulfilled_at, orr.cancelled_at)
    from public.officer_reward_redemptions orr
    left join public.officer_reward_items ori on ori.id = orr.reward_id
    left join public.profiles p on p.id = orr.user_id
    where orr.fulfilled_by = _admin_id or orr.cancelled_by = _admin_id

    union all
    select 'Added shop item', ri.title, ri.created_at
    from public.reward_items ri
    where ri.created_by = _admin_id

    union all
    select 'Added Battlepass shop item', ori.title, ori.created_at
    from public.officer_reward_items ori
    where ori.created_by = _admin_id

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

commit;

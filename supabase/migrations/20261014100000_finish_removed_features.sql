-- The shifts, calendar, storage keys, internal events and portal photo albums features were removed. This finishes what is left in the database:
-- three functions still read the dropped photo_albums table (deleting an event, deleting an account and the admin activity feed would have failed),
-- the shift functions and the event_shifts table, and the calendar subscription token. (A backup of everything was taken before the tables were dropped.)

CREATE OR REPLACE FUNCTION public.admin_delete_event(p_event_id uuid, p_reverse_points boolean DEFAULT true, p_actor uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_tickets int;
  v_points int := 0;
  v_flyer text;
begin
  perform set_config('app.actor', coalesce(p_actor::text, ''), true);

  select flyer_url into v_flyer from events where id = p_event_id;
  if not found then
    raise exception 'Event not found' using errcode = 'P0002';
  end if;

  select count(*) into v_tickets from tickets where event_id = p_event_id;

  if p_reverse_points then
    with d as (
      delete from point_transactions
      where type = 'event_checkin'
        and (event_id = p_event_id
             or ticket_id in (select id from tickets where event_id = p_event_id))
      returning 1
    )
    select count(*) into v_points from d;
  end if;

  delete from events where id = p_event_id;

  return jsonb_build_object(
    'tickets_deleted', v_tickets,
    'point_rows_deleted', v_points,
    'flyer_url', v_flyer
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_delete_account(_user_id uuid, _admin_id uuid, _reassign_to uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.get_admin_activity(_admin_id uuid, _limit integer DEFAULT 30)
 RETURNS TABLE(action text, detail text, occurred_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  ) feed
  where occurred_at is not null
  order by occurred_at desc
  limit _limit;
$function$;

drop function if exists public.claim_shift;
drop function if exists public.take_shift_cover;
drop function if exists public.undo_shift_cover;
drop table if exists public.event_shifts;
alter table public.profiles drop column if exists calendar_token;

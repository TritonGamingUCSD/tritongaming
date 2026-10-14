-- Remove the referral ("invite a friend") feature completely: the invite code on every profile, who-referred-whom, the referral bonus and its ledger type.
-- Nothing was ever referred or paid (0 referred profiles, 0 referral_bonus rows), so no data is lost beyond the unused generated codes.
-- The functions that mentioned referrals are rewritten first, then the columns, index, function and ledger type go.

create or replace function public.award_checkin_points(_ticket_id uuid, _checked_in_by uuid default null)
returns boolean language plpgsql security definer set search_path to 'public' as $function$
declare
  _user_id uuid;
  _event_id uuid;
  _points integer;
  _inserted integer := 0;
begin
  select t.user_id, t.event_id, e.points_value
    into _user_id, _event_id, _points
    from public.tickets t
    join public.events e on e.id = t.event_id
    where t.id = _ticket_id;

  if _user_id is null then
    return false; -- ticket not found — nothing to award
  end if;

  if public.is_rewards_eligible(_user_id) then
    insert into public.point_transactions (user_id, amount, type, event_id, ticket_id, created_by)
    values (_user_id, _points, 'event_checkin', _event_id, _ticket_id, _checked_in_by)
    on conflict (ticket_id) where (type = 'event_checkin' and reversed_at is null) do nothing;
    get diagnostics _inserted = row_count;
  end if;

  return _inserted > 0 and _points > 0;
end;
$function$;

create or replace function public.reverse_checkin(_ticket_id uuid, _reversed_by uuid)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare
  _checkin_id uuid;
  _user_id uuid;
  _amount integer;
  _ticket_updated integer;
begin
  update public.tickets
    set status = 'active', checked_in_at = null, checked_in_by = null,
        checkin_form_completed_at = null
    where id = _ticket_id and status = 'used'
    returning user_id into _user_id;
  get diagnostics _ticket_updated = row_count;

  if _ticket_updated = 0 then
    raise exception 'This ticket isn''t currently checked in — nothing to reverse.';
  end if;

  -- Best-effort from here: a missing points row (zero-point event, or a check-in that predates the points system) just means there is nothing to
  -- reverse on the ledger, not an error — the ticket flip above already happened and stands on its own.
  select id, amount into _checkin_id, _amount
    from public.point_transactions
    where ticket_id = _ticket_id and type = 'event_checkin' and reversed_at is null;

  if _checkin_id is not null then
    update public.point_transactions set reversed_at = now() where id = _checkin_id;

    insert into public.point_transactions (user_id, amount, type, ticket_id, note, created_by, reverses_transaction_id)
    values (_user_id, -_amount, 'admin_adjustment', _ticket_id, 'Check-in reversed (mis-scan/correction)', _reversed_by, _checkin_id);
  end if;
end;
$function$;

create or replace function public.reverse_point_transaction(_transaction_id uuid, _reversed_by uuid)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare
  _txn public.point_transactions%rowtype;
begin
  select * into _txn from public.point_transactions where id = _transaction_id;
  if _txn.id is null then
    raise exception 'Transaction not found.';
  end if;
  if _txn.reversed_at is not null then
    raise exception 'This transaction has already been reversed.';
  end if;
  if _txn.reverses_transaction_id is not null then
    raise exception 'This is itself a reversal and cannot be reversed again — make a new manual adjustment instead.';
  end if;

  if _txn.type = 'event_checkin' then
    perform public.reverse_checkin(_txn.ticket_id, _reversed_by);
  elsif _txn.type = 'redemption' then
    perform public.cancel_redemption(_txn.redemption_id, _reversed_by);
  else
    update public.point_transactions set reversed_at = now() where id = _txn.id;
    insert into public.point_transactions (user_id, amount, type, note, created_by, reverses_transaction_id)
    values (_txn.user_id, -_txn.amount, 'admin_adjustment',
      'Reversed: ' || coalesce(_txn.note, initcap(replace(_txn.type, '_', ' '))), _reversed_by, _txn.id);
  end if;
end;
$function$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $function$
declare
  _full_name text;
begin
  _full_name := trim(coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'));

  insert into public.profiles (id, display_name, avatar_url, google_first_name, google_last_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url',
    nullif(split_part(_full_name, ' ', 1), ''),
    nullif(trim(substring(_full_name from length(split_part(_full_name, ' ', 1)) + 1)), '')
  )
  on conflict (id) do nothing;

  if new.email ilike '%@ucsd.edu' then
    insert into public.user_roles (user_id, role) values (new.id, 'ucsd') on conflict do nothing;
  end if;

  return new;
end;
$function$;

create or replace function public.admin_delete_account(_user_id uuid, _admin_id uuid, _reassign_to uuid default null)
returns void language plpgsql security definer set search_path to 'public' as $function$
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

  -- A plain delete (no merge target) that would remove the last admin would lock everyone out of Member Management — refuse it outright.
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

    update public.docs set created_by = _reassign_to where created_by = _user_id;
    update public.docs set updated_by = _reassign_to where updated_by = _user_id;
  end if;

  delete from public.profiles where id = _user_id;
end;
$function$;

drop function if exists public.referral_bonus_points();
drop index if exists public.point_transactions_referral_key;
alter table public.point_transactions drop column if exists related_user_id;
alter table public.profiles drop column if exists referred_by;
alter table public.profiles drop column if exists referral_code;
alter table public.point_transactions drop constraint if exists point_transactions_type_check;
alter table public.point_transactions add constraint point_transactions_type_check check (type = any (array['event_checkin'::text, 'redemption'::text, 'admin_adjustment'::text]));

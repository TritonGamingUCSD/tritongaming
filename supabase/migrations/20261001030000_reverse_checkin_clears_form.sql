-- Undoing a check-in also clears the AS Form "completed" marker, so if the
-- person is scanned in again they have to go through the form step again
-- instead of being treated as already done. reverse_checkin is the single
-- undo path (the scanner's Undo, the event check-ins list, and the admin
-- points reversal all end up here), so clearing it here covers every one.
create or replace function public.reverse_checkin(_ticket_id uuid, _reversed_by uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  _checkin_id uuid;
  _user_id uuid;
  _amount integer;
  _referred_by uuid;
  _remaining_checkins integer;
  _referral_id uuid;
  _referral_amount integer;
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

  -- Best-effort from here: a missing points row (zero-point event, or a
  -- check-in that predates this points system) just means there's nothing
  -- to reverse on the ledger, not an error — the ticket flip above already
  -- happened and stands on its own.
  select id, amount into _checkin_id, _amount
    from public.point_transactions
    where ticket_id = _ticket_id and type = 'event_checkin' and reversed_at is null;

  if _checkin_id is not null then
    update public.point_transactions set reversed_at = now() where id = _checkin_id;

    insert into public.point_transactions (user_id, amount, type, ticket_id, note, created_by, reverses_transaction_id)
    values (_user_id, -_amount, 'admin_adjustment', _ticket_id, 'Check-in reversed (mis-scan/correction)', _reversed_by, _checkin_id);

    select referred_by into _referred_by from public.profiles where id = _user_id;
    if _referred_by is not null then
      select count(*) into _remaining_checkins
        from public.point_transactions
        where user_id = _user_id and type = 'event_checkin' and reversed_at is null;
      if _remaining_checkins = 0 then
        select id, amount into _referral_id, _referral_amount
          from public.point_transactions
          where related_user_id = _user_id and type = 'referral_bonus' and reversed_at is null;
        if _referral_id is not null then
          update public.point_transactions set reversed_at = now() where id = _referral_id;
          insert into public.point_transactions (user_id, amount, type, related_user_id, note, created_by, reverses_transaction_id)
          values (_referred_by, -_referral_amount, 'admin_adjustment', _user_id, 'Referral bonus reversed (referred check-in undone)', _reversed_by, _referral_id);
        end if;
      end if;
    end if;
  end if;
end;
$function$;

revoke all on function public.reverse_checkin(uuid, uuid) from public, anon, authenticated;
grant execute on function public.reverse_checkin(uuid, uuid) to service_role;

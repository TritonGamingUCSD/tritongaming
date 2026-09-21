-- reverse_checkin previously required an un-reversed event_checkin points
-- row to exist before it would do ANYTHING — including flipping the
-- ticket back to active. That's wrong: a ticket can be legitimately
-- checked in with no points transaction behind it (the event's
-- points_value was 0, or the check-in happened before this points system
-- existed at all), and undoing a mis-scan on one of those tickets should
-- still work. The ticket's own status is the real source of truth for
-- "was this checked in" — points reversal is a best-effort extra on top,
-- not a precondition.
begin;

create or replace function public.reverse_checkin(_ticket_id uuid, _reversed_by uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
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
    set status = 'active', checked_in_at = null, checked_in_by = null
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
$$;

revoke all on function public.reverse_checkin(uuid, uuid) from public, anon, authenticated;

commit;

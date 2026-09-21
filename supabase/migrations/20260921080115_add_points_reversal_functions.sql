-- Reversal functions — a mis-scan or fat-fingered manual code entry
-- shouldn't require an admin to go hand-edit the ledger. Every reversal
-- inserts a compensating transaction rather than deleting the original
-- row, so the ledger stays a true append-only audit trail of what
-- actually happened (award, then correction), not a rewritten history.

begin;

-- Undo an in-person or online check-in: flips the ticket back to active,
-- reverses its point award, and — only if this checkin turns out to have
-- been the referrer's *only* qualifying one for this friend — reverses
-- the referral bonus too, so undoing someone's first (and only) check-in
-- doesn't leave their referrer holding a bonus for an attendance that
-- didn't actually happen.
create or replace function public.reverse_checkin(_ticket_id uuid, _reversed_by uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _user_id uuid;
  _amount integer;
  _remaining_checkins integer;
  _referred_by uuid;
begin
  select user_id, amount into _user_id, _amount
    from public.point_transactions
    where ticket_id = _ticket_id and type = 'event_checkin';

  if _user_id is null then
    raise exception 'No check-in point award found for this ticket — nothing to reverse.';
  end if;

  update public.tickets
    set status = 'active', checked_in_at = null, checked_in_by = null
    where id = _ticket_id and status = 'used';

  delete from public.point_transactions where ticket_id = _ticket_id and type = 'event_checkin';

  insert into public.point_transactions (user_id, amount, type, ticket_id, note, created_by)
  values (_user_id, -_amount, 'admin_adjustment', _ticket_id, 'Check-in reversed (mis-scan/correction)', _reversed_by);

  select referred_by into _referred_by from public.profiles where id = _user_id;
  if _referred_by is not null then
    select count(*) into _remaining_checkins
      from public.point_transactions where user_id = _user_id and type = 'event_checkin';
    if _remaining_checkins = 0 then
      delete from public.point_transactions
        where related_user_id = _user_id and type = 'referral_bonus'
        returning amount into _amount;
      if found then
        insert into public.point_transactions (user_id, amount, type, related_user_id, note, created_by)
        values (_referred_by, -_amount, 'admin_adjustment', _user_id, 'Referral bonus reversed (referred check-in undone)', _reversed_by);
      end if;
    end if;
  end if;
end;
$$;

revoke all on function public.reverse_checkin(uuid, uuid) from public, anon, authenticated;

-- Broadened from the original cancel_redemption (pending-only) to also
-- accept an already-fulfilled redemption — an officer confirming the
-- wrong person's redemption is exactly the kind of mis-input this exists
-- for. Refunds points and restores stock either way.
create or replace function public.cancel_redemption(_redemption_id uuid, _cancelled_by uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _reward_id uuid;
  _user_id uuid;
  _cost integer;
  _updated integer;
begin
  update public.reward_redemptions
    set status = 'cancelled', cancelled_at = now(), cancelled_by = _cancelled_by
    where id = _redemption_id and status in ('pending', 'fulfilled')
    returning reward_id, user_id, point_cost into _reward_id, _user_id, _cost;
  get diagnostics _updated = row_count;
  if _updated = 0 then
    raise exception 'This redemption was already cancelled or does not exist.';
  end if;

  insert into public.point_transactions (user_id, amount, type, redemption_id, note, created_by)
  values (_user_id, _cost, 'admin_adjustment', _redemption_id, 'Refund — redemption cancelled', _cancelled_by);

  update public.reward_items set stock = stock + 1 where id = _reward_id and stock is not null;
end;
$$;

revoke all on function public.cancel_redemption(uuid, uuid) from public, anon, authenticated;

-- General-purpose manual correction — the catch-all for anything the two
-- functions above don't cover (a wrong point value entered before this
-- system existed, a goodwill adjustment, etc). Deliberately free-form
-- rather than trying to anticipate every correction scenario.
create or replace function public.admin_adjust_points(_user_id uuid, _amount integer, _note text, _admin_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if _amount = 0 then
    raise exception 'Adjustment amount can''t be zero.';
  end if;
  insert into public.point_transactions (user_id, amount, type, note, created_by)
  values (_user_id, _amount, 'admin_adjustment', _note, _admin_id);
end;
$$;

revoke all on function public.admin_adjust_points(uuid, integer, text, uuid) from public, anon, authenticated;

commit;

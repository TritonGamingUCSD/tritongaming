-- Fixes a real bug in reverse_checkin (and its referral-bonus cascade):
-- it deleted the original point_transactions row *and* inserted a
-- compensating negative entry for the same amount, which double-
-- subtracts — a member who was mistakenly checked in ends up net
-- -amount instead of net zero once reversed. Fixed by marking rows
-- reversed (reversed_at) instead of deleting them, which also means the
-- ledger keeps every row it ever wrote — true to the append-only design
-- this schema's original comment already claimed but didn't actually
-- implement for this one path.
--
-- Also adds reverse_point_transaction(_transaction_id, _reversed_by): an
-- admin can now reverse one specific, known ledger entry from a member's
-- history (a referral bonus, a past manual adjustment, etc.) instead of
-- reaching for a free-form manual adjustment for something that already
-- has a precise transaction to undo.

begin;

alter table public.point_transactions
  add column if not exists reversed_at timestamptz,
  add column if not exists reverses_transaction_id uuid references public.point_transactions(id);

-- These partial unique indexes exist to stop a *live* duplicate (the same
-- ticket or referral awarding points twice) — a reversed row shouldn't
-- count against that anymore, since the whole point of reversing a
-- check-in is to allow a clean re-check-in afterward.
drop index if exists point_transactions_ticket_checkin_key;
create unique index point_transactions_ticket_checkin_key
  on public.point_transactions (ticket_id) where type = 'event_checkin' and reversed_at is null;

drop index if exists point_transactions_referral_key;
create unique index point_transactions_referral_key
  on public.point_transactions (related_user_id) where type = 'referral_bonus' and reversed_at is null;

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
begin
  select id, user_id, amount into _checkin_id, _user_id, _amount
    from public.point_transactions
    where ticket_id = _ticket_id and type = 'event_checkin' and reversed_at is null;

  if _checkin_id is null then
    raise exception 'No active check-in point award found for this ticket — nothing to reverse.';
  end if;

  update public.tickets
    set status = 'active', checked_in_at = null, checked_in_by = null
    where id = _ticket_id and status = 'used';

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
end;
$$;

revoke all on function public.reverse_checkin(uuid, uuid) from public, anon, authenticated;

-- cancel_redemption's own math was already correct (nothing here was
-- ever deleted) — just now also marks the original row reversed so it
-- participates in the same "already reversed?" check as everything else.
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
  _original_id uuid;
begin
  update public.reward_redemptions
    set status = 'cancelled', cancelled_at = now(), cancelled_by = _cancelled_by
    where id = _redemption_id and status in ('pending', 'fulfilled')
    returning reward_id, user_id, point_cost into _reward_id, _user_id, _cost;
  get diagnostics _updated = row_count;
  if _updated = 0 then
    raise exception 'This redemption was already cancelled or does not exist.';
  end if;

  select id into _original_id from public.point_transactions
    where redemption_id = _redemption_id and type = 'redemption' and reversed_at is null;
  if _original_id is not null then
    update public.point_transactions set reversed_at = now() where id = _original_id;
  end if;

  insert into public.point_transactions (user_id, amount, type, redemption_id, note, created_by, reverses_transaction_id)
  values (_user_id, _cost, 'admin_adjustment', _redemption_id, 'Refund — redemption cancelled', _cancelled_by, _original_id);

  update public.reward_items set stock = stock + 1 where id = _reward_id and stock is not null;
end;
$$;

revoke all on function public.cancel_redemption(uuid, uuid) from public, anon, authenticated;

-- General-purpose: reverses one specific transaction by id, dispatching
-- to the type-specific function when the type has side effects beyond
-- the ledger (event_checkin needs the ticket flipped back to active;
-- redemption needs its status/stock restored) and doing a plain
-- compensating entry otherwise — which also covers reversing a *previous*
-- reversal ("undo my undo"), since a reversal is itself just another
-- admin_adjustment row with nothing special about it.
create or replace function public.reverse_point_transaction(_transaction_id uuid, _reversed_by uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
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

  if _txn.type = 'event_checkin' then
    perform public.reverse_checkin(_txn.ticket_id, _reversed_by);
  elsif _txn.type = 'redemption' then
    perform public.cancel_redemption(_txn.redemption_id, _reversed_by);
  else
    update public.point_transactions set reversed_at = now() where id = _txn.id;
    insert into public.point_transactions (user_id, amount, type, related_user_id, note, created_by, reverses_transaction_id)
    values (_txn.user_id, -_txn.amount, 'admin_adjustment', _txn.related_user_id,
      'Reversed: ' || coalesce(_txn.note, initcap(replace(_txn.type, '_', ' '))), _reversed_by, _txn.id);
  end if;
end;
$$;

revoke all on function public.reverse_point_transaction(uuid, uuid) from public, anon, authenticated;

commit;

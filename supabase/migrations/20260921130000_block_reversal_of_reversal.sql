-- reverse_point_transaction/reverse_officer_point_transaction previously
-- allowed "undo my undo" by design (see the comment above
-- reverse_point_transaction in 20260921093000_...sql) — a reversal row is
-- just another admin_adjustment/manual_award row with nothing marking it
-- as one, so reversing it again passed the only existing guard
-- (reversed_at is null) and produced a third, net-restoring row, with no
-- cap on how many times admins could ping-pong the same lineage.
--
-- On reflection that's not useful: a genuine correction to a past
-- reversal should be a fresh, deliberate manual adjustment (which leaves
-- its own clear note), not a chain of undo-of-undo rows that all read
-- identically in the history list. This adds a straightforward guard:
-- a row that is itself a reversal (reverses_transaction_id is not null)
-- can no longer be reversed.
--
-- Redemption cancellation is unaffected — cancel_redemption/
-- cancel_officer_redemption's refund row is also a reversal
-- (reverses_transaction_id points at the original redemption charge),
-- but a redemption can only ever be cancelled once anyway (guarded by
-- reward_redemptions.status), so this new check is a no-op there in
-- practice, not a behavior change.

begin;

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
  if _txn.reverses_transaction_id is not null then
    raise exception 'This is itself a reversal and cannot be reversed again — make a new manual adjustment instead.';
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

create or replace function public.reverse_officer_point_transaction(_transaction_id uuid, _reversed_by uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _txn public.officer_point_transactions%rowtype;
begin
  select * into _txn from public.officer_point_transactions where id = _transaction_id;
  if _txn.id is null then
    raise exception 'Transaction not found.';
  end if;
  if _txn.reversed_at is not null then
    raise exception 'This transaction has already been reversed.';
  end if;
  if _txn.reverses_transaction_id is not null then
    raise exception 'This is itself a reversal and cannot be reversed again — make a new manual adjustment instead.';
  end if;

  if _txn.type = 'redemption' then
    perform public.cancel_officer_redemption(_txn.redemption_id, _reversed_by);
  else
    update public.officer_point_transactions set reversed_at = now() where id = _txn.id;
    insert into public.officer_point_transactions (user_id, amount, type, note, created_by, reverses_transaction_id)
    values (_txn.user_id, -_txn.amount, 'manual_award',
      'Reversed: ' || coalesce(_txn.note, 'manual award'), _reversed_by, _txn.id);
  end if;
end;
$$;

revoke all on function public.reverse_officer_point_transaction(uuid, uuid) from public, anon, authenticated;

commit;

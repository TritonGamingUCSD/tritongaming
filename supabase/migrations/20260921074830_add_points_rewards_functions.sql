-- Security-definer functions backing the points/rewards system — called
-- via the service-role client from already-capability-checked API routes,
-- same trust model as admin_set_user_roles/admin_db_stats. Every points-
-- affecting write goes through one of these, never a direct client insert,
-- so the ledger (point_transactions) can't be tampered with or drift out
-- of sync with reward_redemptions/reward_items.stock.

begin;

-- Single source of truth for the referral bonus amount — change the
-- number here, nowhere else, if it ever needs tuning. A plain constant
-- isn't expressible at the top level in SQL, so this is the equivalent.
create or replace function public.referral_bonus_points()
returns integer
language sql
immutable
as $$ select 25 $$;

-- Called once per successful check-in (in-person scan or online self-
-- check-in — both funnel through this same function so points can never
-- come from only one of the two paths). Idempotent: the unique partial
-- index on (ticket_id) where type='event_checkin' means a duplicate call
-- for the same ticket is a silent no-op, not a double award.
create or replace function public.award_checkin_points(_ticket_id uuid, _checked_in_by uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _user_id uuid;
  _event_id uuid;
  _points integer;
  _referred_by uuid;
  _prior_checkins integer;
begin
  select t.user_id, t.event_id, e.points_value
    into _user_id, _event_id, _points
    from public.tickets t
    join public.events e on e.id = t.event_id
    where t.id = _ticket_id;

  if _user_id is null then
    return; -- ticket not found — nothing to award
  end if;

  insert into public.point_transactions (user_id, amount, type, event_id, ticket_id, created_by)
  values (_user_id, _points, 'event_checkin', _event_id, _ticket_id, _checked_in_by)
  on conflict (ticket_id) where (type = 'event_checkin') do nothing;

  -- Referral bonus: only the FIRST time this user's own check-in count
  -- becomes 1 (not every event they attend afterward) does their referrer
  -- get paid — checked by counting their event_checkin rows post-insert
  -- rather than trusting a separate "is this their first ticket" flag
  -- that could drift.
  select p.referred_by into _referred_by from public.profiles p where p.id = _user_id;

  if _referred_by is not null then
    select count(*) into _prior_checkins
      from public.point_transactions
      where user_id = _user_id and type = 'event_checkin';

    if _prior_checkins = 1 then
      insert into public.point_transactions (user_id, amount, type, related_user_id, note)
      values (_referred_by, public.referral_bonus_points(), 'referral_bonus', _user_id,
        'Referral bonus — ' || coalesce((select display_name from public.profiles where id = _user_id), 'a friend') || ' attended their first event')
      on conflict (related_user_id) where (type = 'referral_bonus') do nothing;
    end if;
  end if;
end;
$$;

revoke all on function public.award_checkin_points(uuid, uuid) from public, anon, authenticated;

-- Claims a reward: validates balance/stock, debits the ledger, and
-- creates the pending redemption record, all in one transaction so a
-- claim can never partially apply (points gone but no redemption record,
-- or vice versa). Returns the new redemption's id.
create or replace function public.claim_reward(_user_id uuid, _reward_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _title text;
  _cost integer;
  _stock integer;
  _active boolean;
  _balance integer;
  _redemption_id uuid;
  _updated integer;
begin
  select title, point_cost, stock, active into _title, _cost, _stock, _active
    from public.reward_items where id = _reward_id;

  if _title is null then
    raise exception 'That reward no longer exists.';
  end if;
  if not _active then
    raise exception 'That reward is no longer available.';
  end if;
  if _stock is not null and _stock <= 0 then
    raise exception 'That reward is out of stock.';
  end if;

  select coalesce(sum(amount), 0) into _balance
    from public.point_transactions where user_id = _user_id;

  if _balance < _cost then
    raise exception 'Not enough points for this reward.';
  end if;

  if _stock is not null then
    update public.reward_items set stock = stock - 1
      where id = _reward_id and stock > 0;
    get diagnostics _updated = row_count;
    if _updated = 0 then
      raise exception 'That reward just sold out.';
    end if;
  end if;

  insert into public.reward_redemptions (user_id, reward_id, point_cost)
  values (_user_id, _reward_id, _cost)
  returning id into _redemption_id;

  insert into public.point_transactions (user_id, amount, type, redemption_id, note)
  values (_user_id, -_cost, 'redemption', _redemption_id, _title);

  return _redemption_id;
end;
$$;

revoke all on function public.claim_reward(uuid, uuid) from public, anon, authenticated;

-- Officer-side confirmation after scanning a member's redemption QR.
create or replace function public.confirm_redemption(_redemption_id uuid, _officer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _updated integer;
begin
  update public.reward_redemptions
    set status = 'fulfilled', fulfilled_at = now(), fulfilled_by = _officer_id
    where id = _redemption_id and status = 'pending';
  get diagnostics _updated = row_count;
  if _updated = 0 then
    raise exception 'This redemption was already handled or does not exist.';
  end if;
end;
$$;

revoke all on function public.confirm_redemption(uuid, uuid) from public, anon, authenticated;

-- Refunds a pending redemption that was claimed in error / can't actually
-- be fulfilled — restores both the points and any limited stock.
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
    where id = _redemption_id and status = 'pending'
    returning reward_id, user_id, point_cost into _reward_id, _user_id, _cost;
  get diagnostics _updated = row_count;
  if _updated = 0 then
    raise exception 'This redemption was already handled or does not exist.';
  end if;

  insert into public.point_transactions (user_id, amount, type, redemption_id, note, created_by)
  values (_user_id, _cost, 'admin_adjustment', _redemption_id, 'Refund — redemption cancelled', _cancelled_by);

  update public.reward_items set stock = stock + 1 where id = _reward_id and stock is not null;
end;
$$;

revoke all on function public.cancel_redemption(uuid, uuid) from public, anon, authenticated;

commit;

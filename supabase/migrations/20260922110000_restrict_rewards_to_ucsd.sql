-- Restricts the member Rewards/Points system to UCSD students and club
-- staff — previously open to literally anyone with a ticket, including
-- public (non-UCSD) event attendees, which didn't match the club's actual
-- policy. "Eligible" here means holding the 'ucsd' role (auto-granted at
-- signup for an @ucsd.edu email — see handle_new_user) or any active
-- staff/position role (officer/lead/exec/division/admin), which for a
-- UCSD club implies current UCSD affiliation even if that specific
-- person's account wasn't auto-verified via a ucsd.edu email. Explicitly
-- excluded: 'alumni' (no longer a current student) and 'recruit'
-- (pre-membership, not yet verified) — both already get everything else
-- (docs, events, photo albums) at their existing tier; this is the one
-- system carved out as current-student-only.
--
-- IMPORTANT — this preserves the ON CONFLICT predicate fix from
-- 20260921102000_fix_award_checkin_points_on_conflict.sql
-- (type = 'event_checkin' and reversed_at is null / same for
-- referral_bonus), which an earlier draft of *this* migration
-- accidentally reverted by being written against the older,
-- pre-that-fix version of the function. Without "and reversed_at is
-- null" matching the real partial index's predicate exactly, every
-- award silently 42P10s and performCheckin.ts only logs it — see that
-- migration's own comment for the full story. Do not drop that clause
-- again in any future edit of this function.
--
-- Enforced in the same places the app already trusts as the real
-- boundary for points-affecting writes (see this file's own header
-- comment in 20260921074830_add_points_rewards_functions.sql): the
-- award_checkin_points and claim_reward RPCs, not just UI visibility.

begin;

create or replace function public.is_rewards_eligible(_user_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id
      and role in ('ucsd', 'officer', 'lead', 'exec', 'division', 'admin')
  );
$$;

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

  if public.is_rewards_eligible(_user_id) then
    insert into public.point_transactions (user_id, amount, type, event_id, ticket_id, created_by)
    values (_user_id, _points, 'event_checkin', _event_id, _ticket_id, _checked_in_by)
    on conflict (ticket_id) where (type = 'event_checkin' and reversed_at is null) do nothing;
  end if;

  -- Referral bonus: only the FIRST time this user's own check-in count
  -- becomes 1 (not every event they attend afterward) does their referrer
  -- get paid. Counted off `tickets` (actual attendance), not
  -- `point_transactions` — an ineligible referred person never gets an
  -- event_checkin row (see above), so counting transactions would make
  -- this never fire for them even though the referrer still earned the
  -- bonus for bringing in a real new attendee. Still gated on the
  -- REFERRER's own eligibility, since they're the one being paid.
  select p.referred_by into _referred_by from public.profiles p where p.id = _user_id;

  if _referred_by is not null and public.is_rewards_eligible(_referred_by) then
    select count(*) into _prior_checkins
      from public.tickets
      where user_id = _user_id and status = 'used';

    if _prior_checkins = 1 then
      insert into public.point_transactions (user_id, amount, type, related_user_id, note)
      values (_referred_by, public.referral_bonus_points(), 'referral_bonus', _user_id,
        'Referral bonus — ' || coalesce((select display_name from public.profiles where id = _user_id), 'a friend') || ' attended their first event')
      on conflict (related_user_id) where (type = 'referral_bonus' and reversed_at is null) do nothing;
    end if;
  end if;
end;
$$;

revoke all on function public.award_checkin_points(uuid, uuid) from public, anon, authenticated;

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
  if not public.is_rewards_eligible(_user_id) then
    raise exception 'The Rewards shop is only available to UCSD students and club staff.';
  end if;

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

commit;

-- performCheckin.ts's "+N points earned" notification text was only ever
-- gated on `!pointsError` — but since the UCSD-eligibility restriction
-- (20260922110000_restrict_rewards_to_ucsd.sql), an ineligible user's
-- check-in silently skips the insert (no error, just a no-op), so the
-- notification lied and said points were earned when none were. Changing
-- the return type to boolean lets the caller know whether a real
-- event_checkin row was actually inserted.

begin;

-- Postgres won't let CREATE OR REPLACE change a function's return type
-- (void -> boolean); the old one has to go first.
drop function if exists public.award_checkin_points(uuid, uuid);

create function public.award_checkin_points(_ticket_id uuid, _checked_in_by uuid default null)
returns boolean
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

  return _inserted > 0 and _points > 0;
end;
$$;

revoke all on function public.award_checkin_points(uuid, uuid) from public, anon, authenticated;

commit;

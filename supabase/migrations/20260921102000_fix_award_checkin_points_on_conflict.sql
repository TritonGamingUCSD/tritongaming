-- Critical fix: 20260921093000_fix_reversal_math_and_generic_reverse.sql
-- changed the two partial unique indexes on point_transactions to add
-- "and reversed_at is null" to their predicate (so a reversed row frees
-- up the slot for a fresh award), but never updated award_checkin_points'
-- own ON CONFLICT clauses to match. Postgres requires an ON CONFLICT
-- target's predicate to exactly match an existing index's predicate to
-- use it as the arbiter — a mismatch isn't a silent fallback, it's a hard
-- "42P10: there is no unique or exclusion constraint matching the ON
-- CONFLICT specification" error. Since award_checkin_points is called
-- from performCheckin (shared by every check-in path — QR scan, online
-- self-check-in, and the manual check-in button), this has been failing
-- every single check-in's point award since that migration landed, with
-- the error only ever logged (performCheckin treats a points failure as
-- non-fatal to the check-in itself) — so check-ins kept "succeeding"
-- while silently never awarding a single point.

begin;

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
  on conflict (ticket_id) where (type = 'event_checkin' and reversed_at is null) do nothing;

  select p.referred_by into _referred_by from public.profiles p where p.id = _user_id;

  if _referred_by is not null then
    select count(*) into _prior_checkins
      from public.point_transactions
      where user_id = _user_id and type = 'event_checkin' and reversed_at is null;

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

commit;

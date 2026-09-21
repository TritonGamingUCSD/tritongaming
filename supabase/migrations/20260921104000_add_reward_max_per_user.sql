-- Per-user redemption limits — separate from `stock` (a global cap shared
-- across everyone). null means unlimited, same convention as stock. A
-- cancelled/refunded redemption doesn't count against the limit (status
-- in ('pending','fulfilled') only) — a mis-claim an admin corrected
-- shouldn't permanently use up someone's one shot at a reward.
begin;

alter table public.reward_items add column if not exists max_per_user integer;
alter table public.officer_reward_items add column if not exists max_per_user integer;

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
  _max_per_user integer;
  _balance integer;
  _already_claimed integer;
  _redemption_id uuid;
  _updated integer;
begin
  select title, point_cost, stock, active, max_per_user
    into _title, _cost, _stock, _active, _max_per_user
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

  if _max_per_user is not null then
    select count(*) into _already_claimed
      from public.reward_redemptions
      where user_id = _user_id and reward_id = _reward_id and status in ('pending', 'fulfilled');
    if _already_claimed >= _max_per_user then
      raise exception 'You''ve already claimed the max of this reward (%).', _max_per_user;
    end if;
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

create or replace function public.claim_officer_reward(_user_id uuid, _reward_id uuid)
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
  _max_per_user integer;
  _balance integer;
  _already_claimed integer;
  _redemption_id uuid;
  _updated integer;
begin
  select title, point_cost, stock, active, max_per_user
    into _title, _cost, _stock, _active, _max_per_user
    from public.officer_reward_items where id = _reward_id;

  if _title is null then
    raise exception 'That reward no longer exists.';
  end if;
  if not _active then
    raise exception 'That reward is no longer available.';
  end if;
  if _stock is not null and _stock <= 0 then
    raise exception 'That reward is out of stock.';
  end if;

  if _max_per_user is not null then
    select count(*) into _already_claimed
      from public.officer_reward_redemptions
      where user_id = _user_id and reward_id = _reward_id and status in ('pending', 'fulfilled');
    if _already_claimed >= _max_per_user then
      raise exception 'You''ve already claimed the max of this reward (%).', _max_per_user;
    end if;
  end if;

  select coalesce(sum(amount), 0) into _balance
    from public.officer_point_transactions where user_id = _user_id;

  if _balance < _cost then
    raise exception 'Not enough points for this reward.';
  end if;

  if _stock is not null then
    update public.officer_reward_items set stock = stock - 1
      where id = _reward_id and stock > 0;
    get diagnostics _updated = row_count;
    if _updated = 0 then
      raise exception 'That reward just sold out.';
    end if;
  end if;

  insert into public.officer_reward_redemptions (user_id, reward_id, point_cost)
  values (_user_id, _reward_id, _cost)
  returning id into _redemption_id;

  insert into public.officer_point_transactions (user_id, amount, type, redemption_id, note)
  values (_user_id, -_cost, 'redemption', _redemption_id, _title);

  return _redemption_id;
end;
$$;

revoke all on function public.claim_officer_reward(uuid, uuid) from public, anon, authenticated;

commit;

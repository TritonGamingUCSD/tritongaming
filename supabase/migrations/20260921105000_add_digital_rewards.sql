-- Not every reward is something an officer hands over in person — a Fast
-- Pass isn't a physical object to confirm delivery of, it's a status the
-- member already has once they've claimed it. `reward_type` splits the
-- claim flow: 'physical' keeps the existing claim -> QR -> officer scans
-- & confirms flow; 'digital' auto-fulfills the moment it's claimed (no
-- officer step at all — there's nothing to hand over).
--
-- `grants_fast_pass` is a separate, narrower flag (not every digital
-- reward is a fast pass — a Discord role or a digital wallpaper wouldn't
-- be) — see api/tickets/[id]/qr, which checks it to mark a member's own
-- ticket QR screen so they can show it at the door themselves.
begin;

alter table public.reward_items
  add column if not exists reward_type text not null default 'physical' check (reward_type in ('physical', 'digital')),
  add column if not exists grants_fast_pass boolean not null default false;

alter table public.officer_reward_items
  add column if not exists reward_type text not null default 'physical' check (reward_type in ('physical', 'digital')),
  add column if not exists grants_fast_pass boolean not null default false;

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
  _reward_type text;
  _balance integer;
  _already_claimed integer;
  _redemption_id uuid;
  _updated integer;
begin
  select title, point_cost, stock, active, max_per_user, reward_type
    into _title, _cost, _stock, _active, _max_per_user, _reward_type
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

  -- A digital reward has nothing for an officer to hand over, so it's
  -- created already fulfilled — no pending QR-to-scan step at all.
  if _reward_type = 'digital' then
    insert into public.reward_redemptions (user_id, reward_id, point_cost, status, fulfilled_at)
    values (_user_id, _reward_id, _cost, 'fulfilled', now())
    returning id into _redemption_id;
  else
    insert into public.reward_redemptions (user_id, reward_id, point_cost)
    values (_user_id, _reward_id, _cost)
    returning id into _redemption_id;
  end if;

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
  _reward_type text;
  _balance integer;
  _already_claimed integer;
  _redemption_id uuid;
  _updated integer;
begin
  select title, point_cost, stock, active, max_per_user, reward_type
    into _title, _cost, _stock, _active, _max_per_user, _reward_type
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

  if _reward_type = 'digital' then
    insert into public.officer_reward_redemptions (user_id, reward_id, point_cost, status, fulfilled_at)
    values (_user_id, _reward_id, _cost, 'fulfilled', now())
    returning id into _redemption_id;
  else
    insert into public.officer_reward_redemptions (user_id, reward_id, point_cost)
    values (_user_id, _reward_id, _cost)
    returning id into _redemption_id;
  end if;

  insert into public.officer_point_transactions (user_id, amount, type, redemption_id, note)
  values (_user_id, -_cost, 'redemption', _redemption_id, _title);

  return _redemption_id;
end;
$$;

revoke all on function public.claim_officer_reward(uuid, uuid) from public, anon, authenticated;

commit;

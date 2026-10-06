-- Tiers belong to member Rewards only now that the Battlepass is gone: drop the officer branches from the tier functions
-- and narrow the system column to 'member'.

begin;

alter table public.tier_definitions drop constraint if exists tier_definitions_system_check;
alter table public.tier_definitions add constraint tier_definitions_system_check check (system = 'member');

create or replace function public.admin_upsert_tier(_system text, _id uuid, _name text, _min_points integer, _color text)
returns public.tier_definitions
language plpgsql
security definer
set search_path = public
as $$
declare
  _old_min integer;
  _old_name text;
  _row public.tier_definitions;
begin
  if _system <> 'member' then
    raise exception 'Invalid tier system.';
  end if;

  _name := trim(_name);
  if _name = '' then
    raise exception 'Tier name is required.';
  end if;
  if _min_points is null or _min_points < 0 then
    raise exception 'Threshold must be zero or a positive number.';
  end if;

  if _id is null then
    if _min_points = 0 then
      raise exception 'Only the starting tier can be set to 0 points — edit it instead of adding a new one.';
    end if;
    insert into public.tier_definitions (system, name, min_points, color)
      values (_system, _name, _min_points, _color)
      returning * into _row;
  else
    select min_points, name into _old_min, _old_name
      from public.tier_definitions where id = _id and system = _system;
    if _old_name is null then
      raise exception 'Tier not found.';
    end if;
    if _old_min = 0 and _min_points <> 0 then
      raise exception 'The starting tier must stay at 0 points.';
    end if;
    if _old_min <> 0 and _min_points = 0 then
      raise exception 'Only the starting tier can be set to 0 points.';
    end if;

    update public.tier_definitions
      set name = _name, min_points = _min_points, color = _color, updated_at = now()
      where id = _id
      returning * into _row;

    if _old_name <> _name then
      update public.reward_items set min_tier = _name where min_tier = _old_name;
    end if;
  end if;

  return _row;
end;
$$;

revoke all on function public.admin_upsert_tier(text, uuid, text, integer, text) from public, anon, authenticated;

create or replace function public.admin_delete_tier(_system text, _id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _name text;
  _min_points integer;
  _in_use boolean;
begin
  select name, min_points into _name, _min_points
    from public.tier_definitions where id = _id and system = _system and _system = 'member';
  if _name is null then
    raise exception 'Tier not found.';
  end if;
  if _min_points = 0 then
    raise exception 'The starting tier can''t be deleted.';
  end if;

  select exists(select 1 from public.reward_items where min_tier = _name) into _in_use;
  if _in_use then
    raise exception 'This tier is still required by one or more shop items — change or remove those first.';
  end if;

  delete from public.tier_definitions where id = _id;
end;
$$;

revoke all on function public.admin_delete_tier(text, uuid) from public, anon, authenticated;

commit;

-- Makes both tier ladders (member Rewards and officer Battlepass) admin-
-- editable instead of hardcoded in src/lib/tiers.ts / officerTiers.ts.
-- The DB becomes the sole source of truth at runtime for both systems —
-- deliberately no fallback default list on the app side, because a stale
-- hardcoded list silently diverging from what admins configured is exactly
-- how the progress-bar/free-claim bug happened earlier (TIERS[0].min
-- quietly stopped being 0). Better to require every caller to fetch the
-- live list than let one drift out of sync unnoticed.

create table public.tier_definitions (
  id          uuid primary key default gen_random_uuid(),
  system      text not null check (system in ('member', 'officer')),
  name        text not null,
  min_points  integer not null check (min_points >= 0),
  color       text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index tier_definitions_system_name_key on public.tier_definitions (system, name);
create unique index tier_definitions_system_min_points_key on public.tier_definitions (system, min_points);
-- Exactly one floor (0-point) tier per system — the invariant getTier's
-- fallback and nextTier's "first exceeding" search both depend on. A
-- partial unique index makes "two floor tiers" a hard DB error instead of
-- a silent possibility; admin_upsert_tier/admin_delete_tier below add the
-- rest of the protection (can't delete the floor, can't move it off 0,
-- can't set a second tier to 0).
create unique index tier_definitions_system_floor_key on public.tier_definitions (system) where min_points = 0;

alter table public.tier_definitions enable row level security;

-- Readable by anyone signed in — same trust level as reward_items/
-- officer_reward_items (not sensitive, just not worth exposing pre-auth).
create policy "tier definitions readable by authenticated users"
  on public.tier_definitions for select
  using (auth.uid() is not null);

-- No direct insert/update/delete policies. Every write goes through the
-- functions below, called from an already-capability-checked API route via
-- the service-role client (same trust-boundary pattern as
-- admin_award_officer_points etc. — see that function's comment: the
-- capability check lives in the API route, not in here, since a
-- service-role call has no meaningful auth.uid() to check against).
-- Raw RLS-gated writes can't enforce "rename must cascade into
-- reward_items.min_tier" or "the floor tier can't move" atomically the way
-- a single function call can.

insert into public.tier_definitions (system, name, min_points, color) values
  ('member', 'Member', 0, '#6b7280'),
  ('member', 'Bronze', 300, '#c17a4d'),
  ('member', 'Silver', 500, '#a8adb8'),
  ('member', 'Gold', 750, '#ffc72c'),
  ('member', 'Platinum', 1000, '#7dd3fc'),
  ('officer', 'Contributor', 0, '#a3a3a3'),
  ('officer', 'Dedicated', 100, '#60a5fa'),
  ('officer', 'Veteran', 300, '#c084fc'),
  ('officer', 'Legend', 800, '#ffc72c');

-- Create (when _id is null) or update (when _id is set) a tier. Renaming
-- cascades into whichever shop table's min_tier column matches the old
-- name, in the same transaction — otherwise a rename silently orphans any
-- reward gated on the old name (tierRankOf/findIndex would stop matching
-- it, which reads as "no requirement" rather than an error).
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
  if _system not in ('member', 'officer') then
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
      if _system = 'member' then
        update public.reward_items set min_tier = _name where min_tier = _old_name;
      else
        update public.officer_reward_items set min_tier = _name where min_tier = _old_name;
      end if;
    end if;
  end if;

  return _row;
end;
$$;

revoke all on function public.admin_upsert_tier(text, uuid, text, integer, text) from public, anon, authenticated;

-- Refuses to delete the floor tier (breaks the invariant above) or a tier
-- still required by a shop item (would silently unlock/hide it instead of
-- erroring, same class of bug).
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
    from public.tier_definitions where id = _id and system = _system;
  if _name is null then
    raise exception 'Tier not found.';
  end if;
  if _min_points = 0 then
    raise exception 'The starting tier can''t be deleted.';
  end if;

  if _system = 'member' then
    select exists(select 1 from public.reward_items where min_tier = _name) into _in_use;
  else
    select exists(select 1 from public.officer_reward_items where min_tier = _name) into _in_use;
  end if;
  if _in_use then
    raise exception 'This tier is still required by one or more shop items — change or remove those first.';
  end if;

  delete from public.tier_definitions where id = _id;
end;
$$;

revoke all on function public.admin_delete_tier(text, uuid) from public, anon, authenticated;

-- A fully separate points/rewards system for officers, parallel to (but
-- independent from) the member one in 20260921074416_add_points_rewards_system.sql:
-- its own ledger, tier set, shop, and leaderboard. Deliberately NOT sharing
-- any of those tables — an officer who also personally attends events as a
-- member keeps earning normal member points too (unchanged, additive), but
-- recognition for officer-specific contributions (staffing, running
-- events, etc.) lives entirely on its own rails so the two never mix.
--
-- V1 earning source is manual award only (an exec/admin awards points,
-- possibly to several officers at once) — no automatic award path yet, so
-- unlike the member ledger there's no event_id/ticket_id/related_user_id
-- on these transactions at all, just amount + note + who awarded it.

begin;

-- manage_points already exists as a TS-only (UI/API-gating) capability —
-- this is its first real RLS use, so it needs an actual role_capabilities
-- row for exec (admin qualifies for free via has_capability's own bypass).
insert into public.role_capabilities (role, capability) values ('exec', 'manage_points');

create table public.officer_point_transactions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  amount        integer not null,
  type          text not null check (type in ('manual_award', 'redemption')),
  redemption_id uuid,
  note          text,
  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now(),
  -- Same "mark, don't delete" reversal shape as the member ledger (see
  -- 20260921093000_fix_reversal_math_and_generic_reverse.sql) — no reason
  -- to repeat that bug here.
  reversed_at   timestamptz,
  reverses_transaction_id uuid references public.officer_point_transactions(id)
);

create index officer_point_transactions_user_id_idx on public.officer_point_transactions (user_id, created_at desc);

alter table public.officer_point_transactions enable row level security;

create policy "officer point transactions readable by owner or admin dashboard"
  on public.officer_point_transactions for select
  using (auth.uid() = user_id or has_capability('view_admin_dashboard'));
-- No insert/update/delete policy — every write goes through the
-- security-definer functions below, called via the service-role client
-- from manage_points-gated API routes.

create table public.officer_reward_items (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  point_cost  integer not null check (point_cost > 0),
  stock       integer,
  min_tier    text,
  active      boolean not null default true,
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now()
);

alter table public.officer_reward_items enable row level security;

-- Only role-holders (officer/division/lead/exec/admin) can even see the
-- officer shop exists — a plain member browsing the API shouldn't learn
-- what officer-only perks are on offer.
create policy "officer reward items readable by role holders"
  on public.officer_reward_items for select
  using (exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role in ('officer', 'division', 'lead', 'exec', 'admin')
  ));

create policy "officer reward items manageable by manage_points"
  on public.officer_reward_items for all
  using (has_capability('manage_points'))
  with check (has_capability('manage_points'));

create table public.officer_reward_redemptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  reward_id    uuid not null references public.officer_reward_items(id),
  status       text not null default 'pending' check (status in ('pending', 'fulfilled', 'cancelled')),
  point_cost   integer not null,
  claimed_at   timestamptz not null default now(),
  fulfilled_at timestamptz,
  fulfilled_by uuid references public.profiles(id),
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles(id)
);

create index officer_reward_redemptions_user_id_idx on public.officer_reward_redemptions (user_id, claimed_at desc);

alter table public.officer_reward_redemptions enable row level security;

-- Deliberately tighter than the member system's scan_redemptions
-- (officer/lead/exec/admin) — only manage_points (exec/admin) can see or
-- confirm an officer redemption, per direction.
create policy "officer redemptions readable by owner or manage_points"
  on public.officer_reward_redemptions for select
  using (auth.uid() = user_id or has_capability('manage_points'));

alter table public.officer_point_transactions
  add constraint officer_point_transactions_redemption_id_fkey
  foreign key (redemption_id) references public.officer_reward_redemptions(id) on delete set null;

-- ── Functions ────────────────────────────────────────────────────────────

-- Awards the same amount to one or more officers in a single call — the
-- explicit "multiple officers at once" case from direction (e.g. everyone
-- who staffed a given event).
create or replace function public.admin_award_officer_points(_user_ids uuid[], _amount integer, _note text, _admin_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if _amount = 0 then
    raise exception 'Award amount can''t be zero.';
  end if;
  if _user_ids is null or array_length(_user_ids, 1) is null then
    raise exception 'At least one officer must be selected.';
  end if;

  insert into public.officer_point_transactions (user_id, amount, type, note, created_by)
  select u, _amount, 'manual_award', _note, _admin_id from unnest(_user_ids) as u;
end;
$$;

revoke all on function public.admin_award_officer_points(uuid[], integer, text, uuid) from public, anon, authenticated;

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
  _balance integer;
  _redemption_id uuid;
  _updated integer;
begin
  select title, point_cost, stock, active into _title, _cost, _stock, _active
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

create or replace function public.confirm_officer_redemption(_redemption_id uuid, _officer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _updated integer;
begin
  update public.officer_reward_redemptions
    set status = 'fulfilled', fulfilled_at = now(), fulfilled_by = _officer_id
    where id = _redemption_id and status = 'pending';
  get diagnostics _updated = row_count;
  if _updated = 0 then
    raise exception 'This redemption was already handled or does not exist.';
  end if;
end;
$$;

revoke all on function public.confirm_officer_redemption(uuid, uuid) from public, anon, authenticated;

create or replace function public.cancel_officer_redemption(_redemption_id uuid, _cancelled_by uuid)
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
  update public.officer_reward_redemptions
    set status = 'cancelled', cancelled_at = now(), cancelled_by = _cancelled_by
    where id = _redemption_id and status in ('pending', 'fulfilled')
    returning reward_id, user_id, point_cost into _reward_id, _user_id, _cost;
  get diagnostics _updated = row_count;
  if _updated = 0 then
    raise exception 'This redemption was already cancelled or does not exist.';
  end if;

  select id into _original_id from public.officer_point_transactions
    where redemption_id = _redemption_id and type = 'redemption' and reversed_at is null;
  if _original_id is not null then
    update public.officer_point_transactions set reversed_at = now() where id = _original_id;
  end if;

  insert into public.officer_point_transactions (user_id, amount, type, redemption_id, note, created_by, reverses_transaction_id)
  values (_user_id, _cost, 'redemption', _redemption_id, 'Refund — redemption cancelled', _cancelled_by, _original_id);

  update public.officer_reward_items set stock = stock + 1 where id = _reward_id and stock is not null;
end;
$$;

revoke all on function public.cancel_officer_redemption(uuid, uuid) from public, anon, authenticated;

-- General reversal, same shape as reverse_point_transaction on the member
-- ledger — simpler here since there's no event_checkin case to dispatch to
-- (manual award is the only non-redemption type).
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

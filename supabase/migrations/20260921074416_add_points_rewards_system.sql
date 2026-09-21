-- Points & rewards system (V1 scope): points from event check-in
-- (in-person or online self-check-in) and a one-time referral bonus once a
-- referred friend checks into their first event. Discord-join and
-- social-follow point sources are explicitly deferred, per direction —
-- not stubbed here at all, easy to add as a new point_transactions
-- `type` later without touching this schema.

begin;

-- ── role_capabilities ────────────────────────────────────────────────────

insert into public.role_capabilities (role, capability) values
  ('lead',     'manage_rewards_shop'),
  ('exec',     'manage_rewards_shop'),
  ('officer',  'scan_redemptions'),
  ('lead',     'scan_redemptions'),
  ('exec',     'scan_redemptions');
-- 'admin' qualifies for both via has_capability()'s own admin bypass.

-- ── profiles: referral + leaderboard opt-in ─────────────────────────────

alter table public.profiles
  add column referral_code text,
  add column referred_by uuid references public.profiles(id) on delete set null,
  -- Three independent toggles (not one) — someone might want to appear
  -- ranked without their exact point total showing, the same "granular,
  -- not all-or-nothing" shape as board_visibility below.
  add column leaderboard_opt_in boolean not null default false,
  add column leaderboard_show_name boolean not null default true,
  add column leaderboard_show_points boolean not null default true;

-- Backfill existing rows and default new ones via handle_new_user — an
-- 8-char code derived from the user's own id, not a random+retry-on-
-- collision loop: collision odds are the same as two people sharing a
-- UUID prefix, which is already how uniqueness is trusted everywhere else
-- in this schema.
update public.profiles set referral_code = upper(substr(replace(id::text, '-', ''), 1, 8)) where referral_code is null;

alter table public.profiles
  alter column referral_code set not null,
  add constraint profiles_referral_code_key unique (referral_code);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, display_name, avatar_url, referral_code)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url',
    upper(substr(replace(new.id::text, '-', ''), 1, 8))
  )
  on conflict (id) do nothing;

  if new.email ilike '%@ucsd.edu' then
    insert into public.user_roles (user_id, role) values (new.id, 'ucsd') on conflict do nothing;
  end if;

  return new;
end;
$$;

-- ── events: per-event point value ───────────────────────────────────────

alter table public.events add column points_value integer not null default 10;

-- ── point_transactions (append-only ledger — balance is derived, never
--    stored, so it can never drift out of sync with what actually
--    happened) ─────────────────────────────────────────────────────────

create table public.point_transactions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  amount        integer not null,
  type          text not null check (type in ('event_checkin', 'referral_bonus', 'redemption', 'admin_adjustment')),
  event_id      uuid references public.events(id) on delete set null,
  ticket_id     uuid references public.tickets(id) on delete set null,
  related_user_id uuid references public.profiles(id) on delete set null,
  redemption_id uuid,
  note          text,
  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now()
);

create index point_transactions_user_id_idx on public.point_transactions (user_id, created_at desc);
-- A ticket can only ever post its check-in award once.
create unique index point_transactions_ticket_checkin_key
  on public.point_transactions (ticket_id) where type = 'event_checkin';
-- A given referred friend can only ever trigger their referrer's bonus once.
create unique index point_transactions_referral_key
  on public.point_transactions (related_user_id) where type = 'referral_bonus';

alter table public.point_transactions enable row level security;

create policy "point transactions readable by owner or admin dashboard"
  on public.point_transactions for select
  using (auth.uid() = user_id or has_capability('view_admin_dashboard'));
-- No insert/update/delete policy — every write goes through the
-- security-definer functions below (called via the service-role client
-- from trusted API routes), never a direct client mutation.

-- ── reward_items (shop catalog) ─────────────────────────────────────────

create table public.reward_items (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  point_cost  integer not null check (point_cost > 0),
  stock       integer,
  active      boolean not null default true,
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now()
);

alter table public.reward_items enable row level security;

create policy "reward items readable by any member"
  on public.reward_items for select
  using (auth.uid() is not null);

create policy "reward items manageable by manage_rewards_shop"
  on public.reward_items for all
  using (has_capability('manage_rewards_shop'))
  with check (has_capability('manage_rewards_shop'));

-- ── reward_redemptions ───────────────────────────────────────────────────

create table public.reward_redemptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  reward_id     uuid not null references public.reward_items(id),
  status        text not null default 'pending' check (status in ('pending', 'fulfilled', 'cancelled')),
  point_cost    integer not null,
  claimed_at    timestamptz not null default now(),
  fulfilled_at  timestamptz,
  fulfilled_by  uuid references public.profiles(id),
  cancelled_at  timestamptz,
  cancelled_by  uuid references public.profiles(id)
);

create index reward_redemptions_user_id_idx on public.reward_redemptions (user_id, claimed_at desc);
create index reward_redemptions_status_idx on public.reward_redemptions (status) where status = 'pending';

alter table public.reward_redemptions enable row level security;

create policy "redemptions readable by owner or scan_redemptions"
  on public.reward_redemptions for select
  using (auth.uid() = user_id or has_capability('scan_redemptions'));

-- point_transactions.redemption_id references this table, but the FK
-- couldn't be declared until reward_redemptions existed — added now.
alter table public.point_transactions
  add constraint point_transactions_redemption_id_fkey
  foreign key (redemption_id) references public.reward_redemptions(id) on delete set null;

commit;

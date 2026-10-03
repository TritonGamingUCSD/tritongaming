-- A plain history of everything done to someone's strikes and vouchers, each with the reason given. The person sees what happened and why (never who);
-- HR and exec also see who did it. Server-only: no policies.
create table if not exists public.strike_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       text not null check (kind in ('strike_added', 'strike_removed', 'strike_reinstated', 'voucher_given', 'voucher_used', 'voucher_removed')),
  reason     text,
  strike_id  uuid references public.strikes(id) on delete set null,
  voucher_id uuid references public.strike_vouchers(id) on delete set null,
  actor_id   uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists strike_events_user on public.strike_events (user_id, created_at desc);
alter table public.strike_events enable row level security;

-- A voucher HR or exec takes back is kept on record (with why) instead of vanishing, so the person can see it.
alter table public.strike_vouchers add column if not exists removed_at timestamptz;
alter table public.strike_vouchers add column if not exists removed_by uuid references auth.users(id) on delete set null;
alter table public.strike_vouchers add column if not exists removed_reason text;


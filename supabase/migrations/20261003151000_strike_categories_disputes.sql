-- Strike categories, and the quiet "Ask HR about this" a person can send about one of their strikes.
alter table public.strikes add column if not exists category text not null default 'other' check (category in ('meeting', 'event_shift', 'deadline', 'conduct', 'other'));
alter table public.strike_requests add column if not exists category text not null default 'other' check (category in ('meeting', 'event_shift', 'deadline', 'conduct', 'other'));

create table if not exists public.strike_disputes (
  id          uuid primary key default gen_random_uuid(),
  strike_id   uuid not null references public.strikes(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  message     text not null,
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null
);
create index if not exists strike_disputes_strike on public.strike_disputes (strike_id);
alter table public.strike_disputes enable row level security;

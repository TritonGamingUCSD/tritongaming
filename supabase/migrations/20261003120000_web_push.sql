-- Web push: one row per browser/device a member turned notifications on in, plus which kinds of notification they muted.
-- No client access (no policies): everything goes through the server's service role, since the subscription's keys let anyone who has them
-- send that member a notification.
create table if not exists public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  endpoint     text not null unique,
  p256dh       text not null,
  auth         text not null,
  user_agent   text,
  created_at   timestamptz not null default now(),
  last_sent_at timestamptz
);
create index if not exists push_subscriptions_user on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;

create table if not exists public.push_preferences (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  muted       text[] not null default '{}',
  updated_at  timestamptz not null default now()
);
alter table public.push_preferences enable row level security;

-- When someone's strikes were reset, their old record is deleted for good. This remembers when, so the missed meetings from before the reset
-- aren't suggested again.
create table if not exists public.strike_cleared (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  cleared_at timestamptz not null default now()
);
alter table public.strike_cleared enable row level security;

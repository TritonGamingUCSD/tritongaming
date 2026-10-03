-- Exec and leads can ask for someone to get a strike; HR (the "manage strikes" permission) approves or declines. Approving publishes the strike.
-- Server access only (no policies). A requester only ever sees their own requests.
create table if not exists public.strike_requests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,   -- who the strike would be for
  reason        text not null,
  incident_date date not null,
  requested_by  uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  status        text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  decided_by    uuid references auth.users(id) on delete set null,
  decided_at    timestamptz,
  decision_note text,
  strike_id     uuid references public.strikes(id) on delete set null
);
create index if not exists strike_requests_status on public.strike_requests (status, created_at desc);
create index if not exists strike_requests_by on public.strike_requests (requested_by);
alter table public.strike_requests enable row level security;

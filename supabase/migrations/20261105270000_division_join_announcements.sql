-- Join requests and announcements for divisions (step 3 of the division project). A student asks to join a division and its Heads approve or decline; a division's Heads post announcements that its people see on Home.
-- Both tables are read and written by the server only (service role), like event_cohosts: row level security is on with no rules, so nobody can reach them from a browser. Additive, nothing existing changes. Safe to run once.
create table if not exists public.division_join_requests (
  id          uuid primary key default gen_random_uuid(),
  division_id uuid not null references public.divisions(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  message     text,
  status      text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  decided_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  decided_at  timestamptz
);
create unique index if not exists division_join_requests_one_pending on public.division_join_requests (division_id, user_id) where status = 'pending';
create index if not exists division_join_requests_division_idx on public.division_join_requests (division_id, status, created_at desc);
alter table public.division_join_requests enable row level security;

create table if not exists public.division_announcements (
  id          uuid primary key default gen_random_uuid(),
  division_id uuid not null references public.divisions(id) on delete cascade,
  author_id   uuid references public.profiles(id) on delete set null,
  title       text not null,
  body        text not null default '',
  created_at  timestamptz not null default now()
);
create index if not exists division_announcements_division_idx on public.division_announcements (division_id, created_at desc);
alter table public.division_announcements enable row level security;

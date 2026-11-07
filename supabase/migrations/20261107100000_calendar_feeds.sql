-- A private link for subscribing to the portal calendar in Google, Apple or Outlook Calendar: one secret token per person, which they can replace (the old link then stops working). Read and written by the server only.
create table if not exists public.calendar_feeds (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  token      text not null unique,
  created_at timestamptz not null default now()
);
alter table public.calendar_feeds enable row level security;

-- Pinned pages (a star on All Functions; the starred pages show on Home and follow the person across devices) and the Home shout-out (one short message from exec for everyone, with an optional link and an end day).
-- Both tables are read and written only by the server (service role), so row level security is on with no browser policies.
-- Additive. Safe to run once.
create table if not exists public.portal_pins (
  user_id uuid not null references auth.users(id) on delete cascade,
  section_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, section_id)
);
create table if not exists public.home_shoutouts (
  id uuid primary key default gen_random_uuid(),
  message text not null check (char_length(message) between 1 and 280),
  link_url text,
  expires_at timestamptz not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists home_shoutouts_expires_idx on public.home_shoutouts (expires_at desc);
alter table public.portal_pins enable row level security;
alter table public.home_shoutouts enable row level security;

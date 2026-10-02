-- Internal events: events just for the team (socials, recruitment training, workshops). Deliberately
-- separate from meetings: no check-in code and no attendance stats, just who it's for and who says they're
-- coming. Audience works like meetings: live roles + saved groups + individually added people.
-- Service-role routes are the boundary.
create table if not exists public.internal_events (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  event_date   date not null,                 -- Pacific day
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  location     text,
  description  text,
  audience     text[],
  invitees     uuid[] not null default '{}',
  group_ids    uuid[] not null default '{}',
  cancelled    boolean not null default false,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists internal_events_date_idx on public.internal_events (event_date);
create table if not exists public.internal_event_rsvps (
  event_id   uuid not null references public.internal_events(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  status     text not null check (status in ('going', 'maybe', 'not_going')),
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
alter table public.internal_events enable row level security;
alter table public.internal_event_rsvps enable row level security;

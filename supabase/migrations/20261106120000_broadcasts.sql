-- Broadcast: the club's live streams on Twitch and YouTube. A broadcast is a scheduled show (title, time, platform, optional event or tournament it covers); people take roles on it (caster, producer, board operator, camera ...); a checklist tracks the go-live steps.
-- Read and written by the server only (service role). Additive. Safe to run once.
create table if not exists public.broadcasts (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  starts_at     timestamptz not null,
  ends_at       timestamptz,
  platform      text not null default 'both' check (platform in ('twitch', 'youtube', 'both')),
  event_id      uuid references public.events(id) on delete set null,
  tournament_id uuid references public.tournaments(id) on delete set null,
  status        text not null default 'scheduled' check (status in ('scheduled', 'live', 'done', 'cancelled')),
  notes         text not null default '',
  checklist     jsonb not null default '{}'::jsonb,   -- { "<step id>": true }
  vod_url       text,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists broadcasts_starts_idx on public.broadcasts (starts_at desc);

create table if not exists public.broadcast_roles (
  id           uuid primary key default gen_random_uuid(),
  broadcast_id uuid not null references public.broadcasts(id) on delete cascade,
  role         text not null,
  user_id      uuid references public.profiles(id) on delete set null,
  name         text not null default '',
  created_at   timestamptz not null default now()
);
create index if not exists broadcast_roles_b_idx on public.broadcast_roles (broadcast_id);

alter table public.broadcasts enable row level security;
alter table public.broadcast_roles enable row level security;

-- The emoji wall on a meeting's shared screen: each placement is one emoji at a spot on the side strips. No sender is stored (same as the reaction totals).
-- Additive; service role only.
create table if not exists public.meeting_wall (
  id         uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  emoji      text not null,
  x          real not null check (x >= 0 and x <= 100),   -- percent across the screen
  y          real not null check (y >= 0 and y <= 100),   -- percent down the screen
  created_at timestamptz not null default now()
);
create index if not exists meeting_wall_meeting_idx on public.meeting_wall (meeting_id, created_at);
alter table public.meeting_wall enable row level security;

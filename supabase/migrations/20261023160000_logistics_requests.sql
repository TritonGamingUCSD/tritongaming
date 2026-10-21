-- Logistics, stage 4: requests. A lead asks for devices or prizes for one event; the logistics team plans it. Still separate from events and check-in (no foreign key to events).
-- items: for devices [{ what, qty, games[] }] (what = a bundle or a device type), for prizes [{ qty, value }] (how many, around what dollar value each).
create table if not exists public.logistics_requests (
  id           uuid primary key default gen_random_uuid(),
  plan_id      uuid not null references public.logistics_plans(id) on delete cascade,
  kind         text not null check (kind in ('devices', 'prizes')),
  requester_id uuid not null,
  division_id  uuid,
  team         text check (team is null or length(team) <= 120),
  items        jsonb not null default '[]'::jsonb,
  notes        text check (notes is null or length(notes) <= 2000),
  status       text not null default 'submitted' check (status in ('submitted', 'planned', 'done', 'declined')),
  response     text check (response is null or length(response) <= 1000),
  planned_by   uuid,
  planned_at   timestamptz,
  created_by   uuid,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists logistics_requests_plan on public.logistics_requests (plan_id, created_at);
create index if not exists logistics_requests_requester on public.logistics_requests (requester_id);
alter table public.logistics_requests enable row level security;

-- Division docs: pages of writing a division keeps for itself (how-tos, schedules, rules). Each doc picks who reads it: 'heads', 'members' (Members and Heads), 'division' (everyone in the division, Alumni too) or 'public' (also shown on the division's public page).
-- Read and written by the server only (service role), like division_announcements: row level security is on with no rules. Additive. Safe to run once.
create table if not exists public.division_docs (
  id          uuid primary key default gen_random_uuid(),
  division_id uuid not null references public.divisions(id) on delete cascade,
  title       text not null,
  body        text not null default '',
  audience    text not null default 'members' check (audience in ('heads', 'members', 'division', 'public')),
  created_by  uuid references public.profiles(id) on delete set null,
  updated_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists division_docs_division_idx on public.division_docs (division_id, updated_at desc);
alter table public.division_docs enable row level security;

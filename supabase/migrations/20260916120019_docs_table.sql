-- Internal documentation ("how-to" pages) for officers/leads/execs — a
-- simple flat list for now (a free-text category for light grouping in the
-- sidebar), deliberately not the full nested-committee structure the
-- reference Google Site has; this is an MVP to grow later.
create table public.docs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  category text,
  content text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.docs enable row level security;

insert into public.role_capabilities (role, capability) values
  ('officer', 'manage_docs'),
  ('lead',    'manage_docs'),
  ('exec',    'manage_docs')
on conflict do nothing;

create policy "manage_docs can read" on public.docs
  for select using (has_capability('manage_docs'));
create policy "manage_docs can insert" on public.docs
  for insert with check (has_capability('manage_docs'));
create policy "manage_docs can update" on public.docs
  for update using (has_capability('manage_docs')) with check (has_capability('manage_docs'));
create policy "manage_docs can delete" on public.docs
  for delete using (has_capability('manage_docs'));

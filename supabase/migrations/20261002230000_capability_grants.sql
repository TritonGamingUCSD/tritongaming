-- Extra permissions handed to a specific person or a saved group (on top of their role), e.g. the HR
-- team viewing meeting attendance. Admin-managed in Admin → Access. Service-role routes only.
create table if not exists public.capability_grants (
  id          uuid primary key default gen_random_uuid(),
  capability  text not null,
  user_id     uuid references public.profiles(id) on delete cascade,
  group_id    uuid references public.meeting_groups(id) on delete cascade,
  granted_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  check ((user_id is null) <> (group_id is null))
);
create unique index if not exists capability_grants_user_idx on public.capability_grants (capability, user_id) where user_id is not null;
create unique index if not exists capability_grants_group_idx on public.capability_grants (capability, group_id) where group_id is not null;
alter table public.capability_grants enable row level security;

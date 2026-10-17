-- Give roles by pasted email addresses. An address that already belongs to an account gets the role straight away; one that does not is remembered here and
-- the role is given the first time someone signs in (or links) with that address. Waiting grants expire after 90 days.
create table if not exists public.pending_role_grants (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,                         -- lowercase, trimmed
  role        public.app_role not null,
  division_id uuid references public.divisions(id) on delete cascade,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '90 days')
);
create unique index if not exists pending_role_grants_unique on public.pending_role_grants (email, role, coalesce(division_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index if not exists pending_role_grants_email_idx on public.pending_role_grants (email);
alter table public.pending_role_grants enable row level security;   -- service role only

-- Which accounts use these addresses: the sign-in email and every linked email, matched without regard to case. Server only.
create or replace function public.find_users_by_emails(_emails text[])
returns table(user_id uuid, email text)
language sql security definer set search_path = public stable as $$
  select u.id, lower(u.email) from auth.users u where lower(u.email) = any(_emails)
  union
  select i.user_id, lower(i.identity_data->>'email') from auth.identities i where lower(i.identity_data->>'email') = any(_emails);
$$;
revoke all on function public.find_users_by_emails(text[]) from public, anon, authenticated;
grant execute on function public.find_users_by_emails(text[]) to service_role;

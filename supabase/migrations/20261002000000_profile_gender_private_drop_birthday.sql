-- Gender is required profile info now, but public.profiles is readable by
-- everyone (including logged-out visitors) via the REST API, so it must not
-- live there. It goes in its own table that only the owner — and the admin
-- dashboard capability — can read; event exports read it with the service role
-- after their own capability check.
create table if not exists public.profile_private (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  gender text check (gender in ('Male', 'Female', 'Non-binary', 'Other', 'Prefer not to say')),
  updated_at timestamptz not null default now()
);

alter table public.profile_private enable row level security;

drop policy if exists "owner reads own private profile" on public.profile_private;
create policy "owner reads own private profile" on public.profile_private
  for select using (auth.uid() = user_id);

drop policy if exists "owner inserts own private profile" on public.profile_private;
create policy "owner inserts own private profile" on public.profile_private
  for insert with check (auth.uid() = user_id);

drop policy if exists "owner updates own private profile" on public.profile_private;
create policy "owner updates own private profile" on public.profile_private
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "admin dashboard reads private profiles" on public.profile_private;
create policy "admin dashboard reads private profiles" on public.profile_private
  for select using (public.has_capability('view_admin_dashboard'));

-- Birthday is no longer collected anywhere. (It was also readable by anyone
-- through the public profiles policy, so removing it closes that exposure.)
alter table public.profiles drop column if exists birthday;

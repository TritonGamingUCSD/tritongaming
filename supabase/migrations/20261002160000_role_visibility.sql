-- Recruits can see TG Members; alumni can read Documentation. (QR Studio is UI-only gating.)
insert into public.role_capabilities (role, capability) values
  ('recruit', 'view_members'),
  ('alumni',  'view_docs')
on conflict do nothing;

-- Rewards (points, the shop, battlepass-adjacent features) now also open to recruits and alumni.
create or replace function public.is_rewards_eligible(_user_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id
      and role in ('ucsd', 'officer', 'lead', 'exec', 'division', 'admin', 'recruit', 'alumni')
  );
$$;

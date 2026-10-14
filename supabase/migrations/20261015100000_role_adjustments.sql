-- Role changes (2026-10-15):
--  * manage_division (edit a division's page content) is for the Division Lead of that division, exec and admin; Lead no longer has it.
--  * Alumni can open Events (view_events). Alumni still cannot check people in.
--  * Rewards are hidden from Recruits and Alumni: is_rewards_eligible() now says no to anyone holding either role, matching the app.
delete from public.role_capabilities where capability = 'manage_division' and role = 'lead';

insert into public.role_capabilities (role, capability) values ('alumni', 'view_events') on conflict do nothing;

create or replace function public.is_rewards_eligible(_user_id uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role in ('ucsd', 'officer', 'lead', 'exec', 'division', 'admin')
  ) and not exists (
    select 1 from public.user_roles
    where user_id = _user_id and role in ('recruit', 'alumni')
  );
$$;

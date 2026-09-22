-- handle_new_user's 'ucsd' auto-grant only fires on the auth.users INSERT
-- at original signup — linking a ucsd.edu Google account later
-- (LinkGoogleSection.tsx / auth/callback/route.ts) adds an auth.identities
-- row to the *existing* user, not a new auth.users row, so that trigger
-- never runs for it. This lets the callback route re-check on every
-- sign-in/link and grant the role the moment a ucsd.edu identity actually
-- exists, regardless of whether it was the original signup identity.
--
-- Plain "on conflict do nothing" (no column target), same as the trigger
-- itself uses — user_roles_user_id_role_key is a PARTIAL unique index
-- (where role <> 'division'), and Postgres can't match a partial index
-- via an explicit ON CONFLICT (columns) target, which is what tripped up
-- a first attempt at this via a plain PostgREST .upsert() call.

begin;

create or replace function public.grant_ucsd_role(_user_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.user_roles (user_id, role) values (_user_id, 'ucsd') on conflict do nothing;
$$;

revoke all on function public.grant_ucsd_role(uuid) from public, anon, authenticated;

commit;

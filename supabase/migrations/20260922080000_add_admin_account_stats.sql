-- Auth-account health for the System tab — separate from admin_db_stats
-- since this reads auth.users/auth.identities rather than public.*
-- catalogs. Most relevant given this session's work: how many accounts
-- have actually linked a second sign-in method (LinkGoogleSection.tsx)
-- vs. are still single-identity and would be locked out the day their
-- @ucsd.edu Google account gets deleted post-graduation.

begin;

create or replace function public.admin_account_stats()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'total_accounts', (select count(*) from auth.users),
    'multi_identity_accounts', (
      select count(*) from (
        select user_id from auth.identities group by user_id having count(*) > 1
      ) multi
    ),
    'no_role_accounts', (
      select count(*) from public.profiles p
      where not exists (select 1 from public.user_roles ur where ur.user_id = p.id)
    ),
    'signups_last_30d', (select count(*) from auth.users where created_at > now() - interval '30 days')
  );
$$;

revoke all on function public.admin_account_stats() from public, anon, authenticated;

commit;

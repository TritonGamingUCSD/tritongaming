-- Backup Login (BackupLoginSection.tsx) attaches an email+password
-- credential to an account without disturbing its existing Google
-- identity — auth.users.email just becomes whichever one was set most
-- recently, so staff-facing views that show "a member's email" were only
-- ever showing one of potentially two. auth.admin.listUsers() (used for
-- bulk member/role lists) doesn't return each user's `identities` array —
-- only auth.admin.getUserById() does, and doing that per-user for a list
-- of hundreds would be hundreds of Admin API calls. auth.identities isn't
-- exposed through PostgREST (only public/graphql_public are), so this
-- reads it directly in one batched query instead.
begin;

create or replace function public.get_linked_emails(_user_ids uuid[])
returns table(user_id uuid, provider text, email text)
language sql
security definer
set search_path = public
stable
as $$
  select i.user_id, i.provider, i.identity_data->>'email' as email
  from auth.identities i
  where i.user_id = any(_user_ids) and i.identity_data->>'email' is not null;
$$;

revoke all on function public.get_linked_emails(uuid[]) from public, anon, authenticated;

commit;

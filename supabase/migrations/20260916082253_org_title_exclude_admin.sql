-- 'admin' is a platform-permissions role, not an org position, so it
-- shouldn't have implied it was one of the roles allowed to set org_title
-- (see profile_org_title.sql). Someone who's admin AND exec/lead/division/
-- officer is unaffected; admin alone no longer qualifies.
create or replace function public.enforce_org_title_permission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.org_title is distinct from old.org_title then
    if not exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('officer', 'lead', 'division', 'exec')
    ) then
      new.org_title := old.org_title;
    end if;
  end if;
  return new;
end;
$$;

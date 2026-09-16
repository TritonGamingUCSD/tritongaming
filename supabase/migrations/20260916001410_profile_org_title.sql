-- Lets officers/leads/division heads/execs (and admins) label themselves
-- with their org role (e.g. "Marketing Lead") on their own profile — shown
-- on the Members list. Deliberately NOT open to guest/ucsd, since a plain
-- member self-labeling with an org title would be misleading.
--
-- RLS on profiles only ever checked "is this your own row" (id = auth.uid()),
-- with no per-column granularity, so a role gate here needs a trigger rather
-- than a policy: any UPDATE that changes org_title without the right role is
-- silently reverted to its previous value instead of failing the whole save,
-- so an unrelated field edit (e.g. bio) never breaks just because a stale
-- client also sent an org_title the user isn't allowed to set.
alter table public.profiles add column if not exists org_title text;

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
        and ur.role in ('officer', 'lead', 'division', 'exec', 'admin')
    ) then
      new.org_title := old.org_title;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_org_title_permission on public.profiles;
create trigger enforce_org_title_permission
  before update on public.profiles
  for each row execute function public.enforce_org_title_permission();

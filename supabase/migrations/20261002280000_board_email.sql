-- Officers choose which of their linked emails appears on their public officer card.
alter table public.profiles add column if not exists board_email text;

-- Division leads no longer get a public officer card (just basic info), so they can't set an org title any more.
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
        and ur.role in ('officer', 'lead', 'exec')
    ) then
      new.org_title := old.org_title;
    end if;
  end if;
  return new;
end;
$$;

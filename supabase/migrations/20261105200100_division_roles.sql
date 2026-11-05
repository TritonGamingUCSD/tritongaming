-- Divisions get their own roles (see 20261105200000): Division Head ('division'), Division Member ('division_member') and Division Alumni ('division_alumni'), each scoped to one division.
-- * A division role needs a division, any other role must not have one.
-- * A person holds at most one division role per division (a Member who becomes a Head is moved, not duplicated), and any number of divisions. Other roles stay one each.
-- * The Rewards rule needs no change: points are for people whose only role is the UCSD badge, so anyone with a division role earns none, like every other role.
-- * Role names in notifications now say Division Head / Division Member / Division Alumni.
-- Additive for the data (nothing existing changes meaning). Safe to run once.
begin;

alter table public.user_roles drop constraint if exists user_roles_division_scope_ck;
alter table public.user_roles add constraint user_roles_division_scope_ck
  check ((role in ('division', 'division_member', 'division_alumni')) = (division_id is not null));

drop index if exists public.user_roles_user_id_role_key;
create unique index user_roles_user_id_role_key on public.user_roles (user_id, role)
  where role not in ('division', 'division_member', 'division_alumni');

drop index if exists public.user_roles_user_division_key;
create unique index user_roles_user_division_key on public.user_roles (user_id, division_id)
  where role in ('division', 'division_member', 'division_alumni');

create or replace function public.role_label(_role public.app_role)
returns text
language sql
immutable
set search_path = public
as $$
  select case _role
    when 'ucsd' then 'UCSD Student'
    when 'division' then 'Division Head'
    when 'division_member' then 'Division Member'
    when 'division_alumni' then 'Division Alumni'
    when 'officer' then 'Officer'
    when 'lead' then 'Lead'
    when 'exec' then 'Executive'
    when 'admin' then 'Admin'
    when 'alumni' then 'Alumni'
    when 'recruit' then 'Recruit'
    else initcap(replace(_role::text, '_', ' '))
  end;
$$;

commit;

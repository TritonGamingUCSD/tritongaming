-- The quarter calendar, who sits out which quarter, and what "inactive" does to permissions.
-- Server-only tables (RLS on, no policies): everything goes through routes that check who is asking.

create table if not exists public.academic_quarters (
  id          uuid primary key default gen_random_uuid(),
  term        text not null check (term in ('fall', 'winter', 'spring')),
  start_year  int  not null,                 -- the calendar year the academic year starts in (Fall 2026, Winter 2027, Spring 2027 are all start_year 2026)
  starts_on   date not null,
  ends_on     date not null check (ends_on >= starts_on),
  created_at  timestamptz not null default now(),
  unique (term, start_year)
);
alter table public.academic_quarters enable row level security;

-- One row per person per quarter they sit out. No row = active.
create table if not exists public.officer_quarter_status (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  quarter_id uuid not null references public.academic_quarters(id) on delete cascade,
  set_by     uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, quarter_id)
);
alter table public.officer_quarter_status enable row level security;

-- Saving someone's roles replaces their whole role set; the inactive marker is not part of that (it follows the quarter calendar), so keep it.
create or replace function public.admin_set_user_roles(_user_id uuid, _roles jsonb, _granted_by uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _before jsonb;
  _after jsonb;
  _role_names text;
  _had_board_role boolean;
  _has_board_role boolean;
begin
  select coalesce(jsonb_agg(jsonb_build_object('role', role, 'division_id', division_id)), '[]'::jsonb)
    into _before
    from public.user_roles where user_id = _user_id and role <> 'inactive';

  delete from public.user_roles where user_id = _user_id and role <> 'inactive';
  insert into public.user_roles (user_id, role, division_id, granted_by)
  select _user_id, (r->>'role')::app_role, nullif(r->>'division_id', '')::uuid, _granted_by
  from jsonb_array_elements(_roles) as r
  where r->>'role' <> 'inactive';

  _after := coalesce((select jsonb_agg(r) from jsonb_array_elements(_roles) r where r->>'role' <> 'inactive'), '[]'::jsonb);

  insert into public.role_change_log (user_id, changed_by, before, after)
  values (_user_id, _granted_by, _before, _after);

  _had_board_role := exists (select 1 from jsonb_array_elements(_before) as r where r->>'role' in ('exec', 'lead'));
  _has_board_role := exists (select 1 from jsonb_array_elements(_after) as r where r->>'role' in ('exec', 'lead'));
  if _has_board_role and not _had_board_role then
    update public.profiles set show_on_board = true where id = _user_id;
  end if;

  if _before is distinct from _after then
    select string_agg(public.role_label((r->>'role')::app_role), ', ')
      into _role_names
      from jsonb_array_elements(_after) as r;

    insert into public.notifications (user_id, type, title, body, href)
    values (
      _user_id,
      'role_changed',
      'Your role was updated',
      case when _role_names is null or _role_names = ''
        then 'Your roles were removed.'
        else 'You are now: ' || _role_names || '.'
      end,
      '/portal/profile'
    );
  end if;
end;
$$;

-- Inactive people keep every "view" permission and lose the ones that change or run things: anything manage_*, host_*, delete_*, plus checking in,
-- scanning redemptions and attending meetings. Admins are never affected. Mirrors INACTIVE_STRIPPED in src/lib/capabilities.ts.
create or replace function public.has_capability(_capability text, _division_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'admin')
    or (
      exists (
        select 1 from public.user_roles ur
        where ur.user_id = auth.uid()
          and exists (
            select 1 from public.role_capabilities rc
            where rc.role = ur.role and rc.capability = _capability
              and (ur.role <> 'division' or _division_id is null or ur.division_id = _division_id)
          )
      )
      and not (
        exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'inactive')
        and (
          _capability like 'manage\_%' or _capability like 'host\_%' or _capability like 'delete\_%'
          or _capability in ('checkin', 'scan_redemptions', 'attend_meetings')
        )
      )
    );
$$;

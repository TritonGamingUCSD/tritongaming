-- "Your role was updated" notifications built role names via
-- initcap(replace(role, '_', ' ')) — fine for 'lead'/'exec'/'admin', but
-- wrong for the two roles whose real label (see ROLE_LABELS in
-- src/types/database.ts) isn't just their capitalized DB key: 'ucsd'
-- should read "UCSD Student", not "Ucsd", and 'division' should read
-- "Division Lead", not "Division". This adds a small lookup mirroring
-- ROLE_LABELS exactly and uses it here instead.

begin;

create or replace function public.role_label(_role public.app_role)
returns text
language sql
immutable
as $$
  select case _role
    when 'ucsd' then 'UCSD Student'
    when 'division' then 'Division Lead'
    when 'officer' then 'Officer'
    when 'lead' then 'Lead'
    when 'exec' then 'Executive'
    when 'admin' then 'Admin'
    when 'alumni' then 'Alumni'
    when 'recruit' then 'Recruit'
    else initcap(replace(_role::text, '_', ' '))
  end;
$$;

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
    from public.user_roles where user_id = _user_id;

  delete from public.user_roles where user_id = _user_id;
  insert into public.user_roles (user_id, role, division_id, granted_by)
  select _user_id, (r->>'role')::app_role, nullif(r->>'division_id', '')::uuid, _granted_by
  from jsonb_array_elements(_roles) as r;

  _after := coalesce(_roles, '[]'::jsonb);

  insert into public.role_change_log (user_id, changed_by, before, after)
  values (_user_id, _granted_by, _before, _after);

  -- Only on the save that actually GRANTS exec/lead for the first time —
  -- not every subsequent save — so someone who deliberately turns the
  -- toggle back off after being promoted doesn't get overridden again the
  -- next time an admin touches their roles for an unrelated reason.
  _had_board_role := exists (select 1 from jsonb_array_elements(_before) as r where r->>'role' in ('exec', 'lead'));
  _has_board_role := exists (select 1 from jsonb_array_elements(_after) as r where r->>'role' in ('exec', 'lead'));
  if _has_board_role and not _had_board_role then
    update public.profiles set show_on_board = true where id = _user_id;
  end if;

  -- RoleManager re-submits the user's full role set on every save, even
  -- when nothing was actually touched — only notify when the set genuinely
  -- differs, or every save (including no-op ones) would spam a "your role
  -- changed" notification that didn't actually change anything.
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

commit;

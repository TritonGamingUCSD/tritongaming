-- Extends admin_set_user_roles (see 20260919074747_add_role_change_log.sql)
-- to also (a) drop a notification for the affected user and (b) auto-flip
-- show_on_board to true when they're granted exec/lead — both exec and
-- lead already appear on the public About page unconditionally regardless
-- of this flag (see getBoardMembers.ts), so leaving it false just meant a
-- newly-promoted exec/lead's own profile settings looked out of sync with
-- reality until they happened to notice and flip it themselves. Only ever
-- flips false -> true, never the reverse — an exec/lead who explicitly
-- turned it off after being promoted keeps that choice on the next save.

begin;

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
    select string_agg(initcap(replace(r->>'role', '_', ' ')), ', ')
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

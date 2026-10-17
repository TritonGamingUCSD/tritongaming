-- A meeting's list of who was expected is locked when check-in closes (the scheduled end, or when the host closes it).
-- After that, role and team changes never change who was expected, so attendance rates and strikes stay fair.
create table if not exists public.meeting_expected (
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  primary key (meeting_id, user_id)
);
alter table public.meeting_expected enable row level security;
revoke all on public.meeting_expected from anon, authenticated;
grant all on public.meeting_expected to service_role;
alter table public.meetings add column if not exists expected_locked_at timestamptz;

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
  _old jsonb;
begin
  -- Keep the date each role was first given: a re-save of someone's roles must not make an old role look new.
  select coalesce(jsonb_agg(jsonb_build_object('role', role, 'division_id', division_id, 'created_at', created_at)), '[]'::jsonb)
    into _old from public.user_roles where user_id = _user_id and role <> 'inactive';

  select coalesce(jsonb_agg(jsonb_build_object('role', role, 'division_id', division_id)), '[]'::jsonb)
    into _before
    from public.user_roles where user_id = _user_id and role <> 'inactive';

  delete from public.user_roles where user_id = _user_id and role <> 'inactive';
  insert into public.user_roles (user_id, role, division_id, granted_by, created_at)
  select _user_id, (r->>'role')::app_role, nullif(r->>'division_id', '')::uuid, _granted_by,
    coalesce((select (o->>'created_at')::timestamptz from jsonb_array_elements(_old) o where o->>'role' = r->>'role' and coalesce(o->>'division_id', '') = coalesce(r->>'division_id', '') limit 1), now())
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

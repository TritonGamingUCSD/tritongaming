-- Audit log: who created / changed / deleted what. Two sources feed it:
--  * triggers on tables that people edit directly (events, divisions, docs,
--    doc categories, photo albums, reward items) — the acting user comes from
--    their login (auth.uid()), or from `app.actor` when a server function
--    (like admin_delete_event) sets it;
--  * server routes for sensitive actions that run with the service role
--    (account delete/merge, point reversals, manual check-ins ...), which call
--    log_audit() / insert directly with the acting admin's id.
-- Readable only by the admin dashboard capability; nobody can edit or delete rows.

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_id uuid references public.profiles(id) on delete set null,
  actor_name text,                       -- snapshot, survives the profile being deleted
  action text not null,                  -- create | update | delete | other verbs from server routes
  entity_type text not null,             -- event | division | doc | ...
  entity_id text,
  summary text not null,
  details jsonb
);

create index if not exists audit_log_created_idx on public.audit_log (created_at desc);
create index if not exists audit_log_entity_idx on public.audit_log (entity_type, created_at desc);

alter table public.audit_log enable row level security;
drop policy if exists "admin dashboard reads audit log" on public.audit_log;
create policy "admin dashboard reads audit log" on public.audit_log
  for select using (public.has_capability('view_admin_dashboard'));

-- Server routes use this (service role) so the snapshot name is filled in.
create or replace function public.log_audit(
  p_actor uuid, p_action text, p_entity_type text, p_entity_id text, p_summary text, p_details jsonb default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_log (actor_id, actor_name, action, entity_type, entity_id, summary, details)
  values (p_actor, (select display_name from public.profiles where id = p_actor), p_action, p_entity_type, p_entity_id, p_summary, p_details);
end;
$$;
revoke all on function public.log_audit(uuid, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.log_audit(uuid, text, text, text, text, jsonb) to service_role;

-- Generic row trigger. TG_ARGV[0] = entity label ("event"), TG_ARGV[1] = the
-- column that names the row ("title" / "name").
create or replace function public.audit_row_change()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := coalesce(auth.uid(), nullif(current_setting('app.actor', true), '')::uuid);
  v_row jsonb := to_jsonb(coalesce(new, old));
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_name text := v_row ->> tg_argv[1];
  v_details jsonb := '{}'::jsonb;
  v_key text;
  v_skip text[] := array['updated_at', 'updated_by', 'checkin_secret', 'created_at', 'order_index', 'sort_order'];
begin
  if tg_op = 'UPDATE' then
    for v_key in select jsonb_object_keys(v_new) loop
      if v_key = any (v_skip) then continue; end if;
      if v_new -> v_key is distinct from v_old -> v_key then
        v_details := v_details || jsonb_build_object(v_key, jsonb_build_object(
          'from', left(v_old ->> v_key, 200), 'to', left(v_new ->> v_key, 200)));
      end if;
    end loop;
    if v_details = '{}'::jsonb then return new; end if;   -- nothing meaningful changed
  end if;

  insert into public.audit_log (actor_id, actor_name, action, entity_type, entity_id, summary, details)
  values (
    v_actor,
    (select display_name from public.profiles where id = v_actor),
    lower(tg_op),
    tg_argv[0],
    coalesce(v_row ->> 'id', v_row ->> 'key'),
    initcap(tg_argv[0]) || ' "' || coalesce(v_name, '(unnamed)') || '" ' ||
      case tg_op when 'INSERT' then 'created' when 'UPDATE' then 'edited' else 'deleted' end,
    case when tg_op = 'UPDATE' then v_details else null end
  );
  return coalesce(new, old);
end;
$$;

do $$
declare t record;
begin
  for t in select * from (values
    ('events', 'event', 'title'),
    ('divisions', 'division', 'name'),
    ('docs', 'doc', 'title'),
    ('doc_categories', 'doc category', 'name'),
    ('photo_albums', 'photo album', 'title'),
    ('reward_items', 'reward', 'title'),
    ('officer_reward_items', 'officer reward', 'title')
  ) as v(tbl, label, name_col) loop
    execute format('drop trigger if exists audit_%I on public.%I', t.tbl, t.tbl);
    execute format('create trigger audit_%I after insert or update or delete on public.%I for each row execute function public.audit_row_change(%L, %L)', t.tbl, t.tbl, t.label, t.name_col);
  end loop;
end $$;

-- Let the event-delete function say who is doing it (it runs with the service role).
create or replace function public.admin_delete_event(
  p_event_id uuid,
  p_reverse_points boolean default true,
  p_actor uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tickets int;
  v_points int := 0;
  v_albums int;
  v_flyer text;
begin
  perform set_config('app.actor', coalesce(p_actor::text, ''), true);

  select flyer_url into v_flyer from events where id = p_event_id;
  if not found then
    raise exception 'Event not found' using errcode = 'P0002';
  end if;

  select count(*) into v_tickets from tickets where event_id = p_event_id;
  select count(*) into v_albums from photo_albums where event_id = p_event_id;

  if p_reverse_points then
    with d as (
      delete from point_transactions
      where type = 'event_checkin'
        and (event_id = p_event_id
             or ticket_id in (select id from tickets where event_id = p_event_id))
      returning 1
    )
    select count(*) into v_points from d;
  end if;

  update photo_albums set event_id = null where event_id = p_event_id;
  delete from events where id = p_event_id;

  return jsonb_build_object(
    'tickets_deleted', v_tickets,
    'point_rows_deleted', v_points,
    'albums_detached', v_albums,
    'flyer_url', v_flyer
  );
end;
$$;
revoke all on function public.admin_delete_event(uuid, boolean, uuid) from public, anon, authenticated;
grant execute on function public.admin_delete_event(uuid, boolean, uuid) to service_role;
drop function if exists public.admin_delete_event(uuid, boolean);

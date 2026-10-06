-- Audit entries from service-role routes (doc publish, etc.) showed "system". Use the row's own updated_by/created_by
-- when there is no login, and stop logging every doc autosave.

begin;

create or replace function public.audit_row_change()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  -- A service-role route has no login of its own, so fall back to who the row says touched it
  -- (a published doc's updated_by, an autosave's draft_updated_by, a creator) instead of logging "system".
  v_actor uuid := coalesce(
    auth.uid(),
    nullif(current_setting('app.actor', true), '')::uuid,
    nullif(to_jsonb(coalesce(new, old)) ->> 'updated_by', '')::uuid,
    nullif(to_jsonb(coalesce(new, old)) ->> 'created_by', '')::uuid
  );
  v_row jsonb := to_jsonb(coalesce(new, old));
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_name text := v_row ->> tg_argv[1];
  v_details jsonb := '{}'::jsonb;
  v_key text;
  v_skip text[] := array['updated_at', 'updated_by', 'checkin_secret', 'created_at', 'order_index', 'sort_order',
                         'draft_title', 'draft_content', 'draft_updated_at', 'draft_updated_by'];  -- autosaved drafts are not worth a log line each
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

commit;

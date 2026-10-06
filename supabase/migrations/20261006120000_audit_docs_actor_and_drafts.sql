-- The audit log no longer records every autosave of a doc draft, and names the person who published a doc (the docs routes run with the
-- service role, so there is no signed-in user on the row).
create or replace function public.audit_row_change()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := coalesce(auth.uid(), nullif(current_setting('app.actor', true), '')::uuid,
    -- The docs routes act with the service role, so a doc's last publisher (updated_by) is the person behind a publish.
    case when tg_table_name = 'docs' then nullif(to_jsonb(coalesce(new, old)) ->> 'updated_by', '')::uuid end);
  v_row jsonb := to_jsonb(coalesce(new, old));
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_name text := v_row ->> tg_argv[1];
  v_details jsonb := '{}'::jsonb;
  v_key text;
  v_skip text[] := array['updated_at', 'updated_by', 'checkin_secret', 'created_at', 'order_index', 'sort_order',
                    -- autosaved drafts, version counters and pin order are not changes anyone needs to see in the log
                    'draft_title', 'draft_content', 'draft_updated_at', 'draft_updated_by', 'revision', 'pin_order'];
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

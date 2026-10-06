-- Every stored file the site still points to, found by reading every text / jsonb / text[] column in the public schema for our storage
-- links (event stickers and fonts inside an event's theme, page blocks, docs, divisions, avatars...). The storage tidy-up uses this so
-- it can never delete something a page still shows: the old cleanup only looked at three columns and removed event stickers.
-- Returns "bucket/path" (still URL-encoded). The audit log is skipped: it only mentions files that were already removed.
create or replace function public.storage_referenced_paths()
returns setof text
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in
    select c.table_name, c.column_name
    from information_schema.columns c
    join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
    where c.table_schema = 'public'
      and c.table_name <> 'audit_log'
      and (c.data_type in ('text', 'character varying', 'jsonb', 'json') or c.udt_name in ('_text', '_varchar'))
  loop
    return query execute format(
      'select distinct m[1] from public.%I, regexp_matches(%I::text, %L, ''g'') as m',
      r.table_name, r.column_name, '/storage/v1/object/public/([^"\s)\\,]+)'
    );
  end loop;
end;
$$;

revoke all on function public.storage_referenced_paths() from public, anon, authenticated;
grant execute on function public.storage_referenced_paths() to service_role;

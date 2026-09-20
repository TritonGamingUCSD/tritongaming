-- Powers the Admin > Storage tab's new "Database" panel. Row counts use
-- pg_stat_user_tables' n_live_tup (a maintained estimate) rather than
-- count(*) per table — exact counts would mean a full sequential scan of
-- every table on every load of an admin page, which gets slower as the
-- org's data grows for a number nobody needs to the exact row.

begin;

create or replace function public.admin_db_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _result jsonb;
begin
  select jsonb_build_object(
    'database_bytes', pg_database_size(current_database()),
    'tables', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'name', relname,
        'row_estimate', greatest(n_live_tup, 0),
        'total_bytes', pg_total_relation_size(relid),
        'table_bytes', pg_relation_size(relid)
      ) order by pg_total_relation_size(relid) desc), '[]'::jsonb)
      from pg_stat_user_tables
      where schemaname = 'public'
    )
  ) into _result;
  return _result;
end;
$$;

-- Newly created functions are PUBLIC-executable by default — this exposes
-- table sizes and row counts, which is fine for service-role callers (the
-- system-stats API route, gated to admins there) but should never be
-- reachable by a regular authenticated user calling the RPC directly.
revoke all on function public.admin_db_stats() from public;
revoke all on function public.admin_db_stats() from anon, authenticated;

commit;

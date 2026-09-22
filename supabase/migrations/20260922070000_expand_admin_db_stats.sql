-- Extends admin_db_stats (20260920023015_add_admin_db_stats.sql) with a
-- few more system-health signals for the System tab, which felt thin next
-- to how much else got built this session: Postgres version, how many
-- public tables have RLS actually turned on (a quick "did anyone forget
-- to enable RLS on a new table" check), and the current connection count
-- (a cheap "is something leaking connections" signal). All read-only,
-- system-catalog queries — no new write surface.

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
    'postgres_version', split_part(version(), ' on ', 1),
    'active_connections', (select count(*) from pg_stat_activity where datname = current_database()),
    'rls_enabled_tables', (select count(*) from pg_tables t join pg_class c on c.relname = t.tablename and c.relnamespace = 'public'::regnamespace where t.schemaname = 'public' and c.relrowsecurity),
    'total_tables', (select count(*) from pg_tables where schemaname = 'public'),
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

revoke all on function public.admin_db_stats() from public;
revoke all on function public.admin_db_stats() from anon, authenticated;

commit;

-- admin_set_user_roles has no permission check of its own (the API routes check, then call it with the service key), so it must not be callable
-- from the public REST endpoint: anyone could have granted themselves any role. The trigger functions never need to be called directly either.
revoke execute on function public.admin_set_user_roles(uuid, jsonb, uuid) from public, anon, authenticated;
revoke execute on function public.audit_alert_admins() from public, anon, authenticated;
revoke execute on function public.audit_row_change() from public, anon, authenticated;
revoke execute on function public.enforce_org_title_permission() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Pin the search path on the remaining helper functions so a caller cannot shadow what they use.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('is_rewards_eligible', 'handle_new_user', 'update_comment_count', 'update_vote_score', 'academic_year_end', 'class_of_to_year', 'profiles_sync_year', 'role_label')
      and p.proconfig is null
  loop
    execute format('alter function %s set search_path = public', f.sig);
  end loop;
end $$;

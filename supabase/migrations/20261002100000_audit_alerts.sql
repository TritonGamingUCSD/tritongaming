-- Risky actions ping every admin (except whoever did it) through the notification bell.
create or replace function public.audit_alert_admins()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_risky boolean;
begin
  v_risky :=
    new.action in ('delete', 'merge', 'reverse')
    or (new.entity_type = 'account')
    or (new.entity_type = 'tier' and new.action = 'update')
    or (new.entity_type = 'points' and new.action = 'adjust');
  if not v_risky then return new; end if;

  insert into public.notifications (user_id, type, title, body, href)
  select ur.user_id,
         'audit_alert',
         'Audit alert: ' || new.action || ' ' || new.entity_type,
         coalesce(new.summary, '') || case when new.actor_name is not null then ' — by ' || new.actor_name else '' end,
         '/portal?section=admin&tab=audit'
  from public.user_roles ur
  where ur.role = 'admin'
    and ur.user_id is distinct from new.actor_id;
  return new;
end;
$$;

drop trigger if exists audit_log_alert on public.audit_log;
create trigger audit_log_alert
  after insert on public.audit_log
  for each row execute function public.audit_alert_admins();

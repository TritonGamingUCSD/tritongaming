-- Risky actions ping every admin (see 20261002100000_audit_alerts.sql), but not when the actor is a throwaway test account: the check scripts name their
-- accounts "ZZ ...", and their deletes were filling real admins' bells with alerts about test data. The audit log entry is still written.
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
  if new.actor_name ilike 'zz%' then return new; end if;

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

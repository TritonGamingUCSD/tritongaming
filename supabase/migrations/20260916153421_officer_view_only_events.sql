-- Officers could create/edit events (manage_events) — they should only be
-- able to view them. manage_events narrows to lead/exec/admin; view_events
-- is the new, broader read-only capability that officer keeps. Reading
-- events was never actually gated by manage_events (published events are
-- public, drafts ride on view_members — see "published events visible to
-- all" policy), so no SELECT policy needs to change here, just the
-- INSERT/UPDATE grant officers no longer get.
delete from public.role_capabilities where role = 'officer' and capability = 'manage_events';
insert into public.role_capabilities (role, capability) values
  ('officer', 'view_events'),
  ('lead',    'view_events'),
  ('exec',    'view_events')
on conflict do nothing;

-- Run after add_alumni_recruit_roles.sql has committed (new enum values
-- can't be used in the same transaction that adds them).
begin;

insert into public.role_capabilities (role, capability) values
  ('recruit', 'view_events'),
  ('recruit', 'view_docs');

commit;

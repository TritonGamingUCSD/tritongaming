-- Lets one person lead more than one division. The original unique index
-- (user_roles_user_id_role_key on (user_id, role), added in
-- 20260915033819_multi_role_capabilities.sql) capped every role — including
-- 'division' — to a single row per user, so a second 'division' row for the
-- same person was always rejected regardless of division_id.
--
-- Every other role (officer/lead/exec/admin/ucsd) still makes sense as
-- at-most-one-per-user, so that cap stays for them; 'division' is carved out
-- into its own uniqueness rule keyed on (user_id, division_id) instead, so a
-- user can hold several division rows (one per division) but can't hold the
-- exact same division twice.

begin;

drop index if exists public.user_roles_user_id_role_key;

create unique index user_roles_user_id_role_key
  on public.user_roles (user_id, role)
  where role <> 'division';

create unique index user_roles_user_division_key
  on public.user_roles (user_id, division_id)
  where role = 'division';

commit;

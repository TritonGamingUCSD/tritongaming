-- Divisions get their own roles, next to the club's: Division Head (the existing 'division' role, which used to be called Division Lead), Division Member and Division Alumni.
-- Each belongs to one division (user_roles.division_id). This file only adds the two new values; Postgres does not allow a new enum value to be used in the transaction that adds it,
-- so everything that uses them is in the next migration.
-- Additive. Safe to run once.
alter type public.app_role add value if not exists 'division_member';
alter type public.app_role add value if not exists 'division_alumni';

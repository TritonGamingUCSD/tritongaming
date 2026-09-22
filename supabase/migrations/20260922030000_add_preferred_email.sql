-- Lets a member choose which of their linked emails (see
-- get_linked_emails / LinkGoogleSection.tsx) shows in staff-facing views
-- (Members, Role Manager, Admin roster) instead of always showing every
-- one. No FK to auth.identities (cross-schema, and identities don't have
-- a stable natural key worth referencing) — just a plain text column,
-- validated against the caller's own actual linked emails client-side
-- before saving, same trust level as any other self-service profile field.

begin;

alter table public.profiles add column if not exists preferred_email text;

commit;

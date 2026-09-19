-- Two new roles: 'alumni' (graduated members — their @ucsd.edu Google login
-- gets deleted by the university after graduation, see the separate
-- identity-linking work for that) and 'recruit' (someone who just joined,
-- pre-Officer). Both are badge-only by default; 'recruit' additionally gets
-- view_events + view_docs (seeded in the next migration) since they're
-- mid-onboarding and reading the calendar/docs before their first official
-- role makes sense; 'alumni' gets nothing beyond the badge itself, but is
-- separately made eligible to opt into the public About page board (see
-- get BoardMembers.ts) the same way officers do.
--
-- Split into its own migration/transaction on purpose — Postgres forbids
-- using a newly-added enum value inside the same transaction that added it,
-- so the role_capabilities seed for 'recruit' has to be a separate file.

alter type public.app_role add value 'alumni';
alter type public.app_role add value 'recruit';

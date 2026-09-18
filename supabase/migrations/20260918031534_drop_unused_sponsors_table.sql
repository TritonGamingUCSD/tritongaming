-- The `sponsors` table (and its manage_sponsors/delete_sponsors RLS
-- policies + capabilities) was scaffolded for a relational sponsors CRUD
-- feature that never actually shipped — the app has always managed sponsor
-- logos through the generic site_contents CMS instead (see the 'sponsors'
-- key in content-blocks.ts, gated by manage_site_content). Confirmed dead:
-- zero `.from('sponsors')` calls anywhere in the app, and the table itself
-- is empty. Dropping it also drops its attached RLS policies automatically.
drop table if exists public.sponsors;

-- The only capability this table's policies used that was actually seeded
-- anywhere (delete_sponsors never had a seeded row — see the "not seeded
-- per-row here" comment in multi_role_capabilities.sql, i.e. it only ever
-- worked through the admin role's blanket bypass). Nothing left to protect.
delete from public.role_capabilities where capability in ('manage_sponsors', 'delete_sponsors');

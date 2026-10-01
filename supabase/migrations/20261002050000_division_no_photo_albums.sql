-- A division lead role on its own no longer grants access to the Photo Albums.
-- (The app-side map in src/lib/capabilities.ts is updated to match; this table
-- drives RLS, which is the real enforcement.) Someone who is also an officer,
-- lead or exec keeps access through those roles.
delete from public.role_capabilities
where role = 'division' and capability = 'view_photo_albums';

-- Four capability changes, per direction:
-- - alumni can now browse the Members directory (previously officer/lead/
--   exec/admin only) — alumni already see view_photo_albums/view_docs
--   despite being former members, so this brings Members into line with
--   that existing "alumni stay read-only-visible" pattern.
-- - recruit can now use the check-in scanner — previously view_events/
--   view_docs only (pre-Officer, read-only); this lets a recruit actually
--   help staff an event's check-in table before formally becoming Officer.
-- - exec loses view_admin_dashboard (the Overview/Roles/Analytics/System
--   Admin section) — manage_site_content (Edit Site Content) is untouched,
--   so exec keeps that entirely separate section.
-- - manage_rewards_shop (creating/editing/retiring shop items, both member
--   Rewards and Battlepass) is now exec+admin only, not lead — tightened
--   to match manage_points' existing "correction-level ops decisions are
--   exec+" reasoning instead of the broader lead-level bar the rest of
--   manage_rewards_shop's own comment describes.

begin;

insert into public.role_capabilities (role, capability) values
  ('alumni', 'view_members'),
  ('recruit', 'checkin')
on conflict do nothing;

delete from public.role_capabilities where role = 'exec' and capability = 'view_admin_dashboard';
delete from public.role_capabilities where role = 'lead' and capability = 'manage_rewards_shop';

commit;

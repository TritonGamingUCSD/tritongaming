-- Site content (public marketing copy — banners, stats, page text) is an
-- org-wide, exec-tier responsibility, not tied to any one committee a Lead
-- runs. 'admin' is already covered separately — it qualifies for every
-- capability unconditionally via has_capability(), not through a row here.
delete from public.role_capabilities where role = 'lead' and capability = 'manage_site_content';

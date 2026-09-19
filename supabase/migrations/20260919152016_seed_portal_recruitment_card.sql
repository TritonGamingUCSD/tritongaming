-- Adds a fourth "Join the Team" pathway card pointing at the Member
-- Portal — a low-footprint way to surface it from the homepage without
-- touching nav/footer or gating anything. jsonb `||` merge (not a bare
-- overwrite) so this only adds the new portal_* keys; whatever an admin
-- has already customized on officer/discord/social stays exactly as-is.
update public.site_contents
set content = content || '{
  "portal_title": "Already a Member?",
  "portal_body": "Your tickets, upcoming events, and everything else all live in one place — no digging through email or Discord.",
  "portal_cta": "Open Portal",
  "portal_href": "/portal"
}'::jsonb
where key = 'homepage.recruitment';

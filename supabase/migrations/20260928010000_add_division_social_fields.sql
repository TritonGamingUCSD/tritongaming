-- Expands what a division's own page can show, beyond just a description +
-- Discord link: an officer-application link (most divisions run their own
-- recruitment separate from the club-wide one), a row of social platform
-- links (reusing the exact same key/shape as profiles.social_links —
-- see lib/profile.ts's SOCIAL_PLATFORMS/socialHref, so the same icon
-- assets and URL-building logic work unchanged here), and embedded
-- social posts (reusing SocialEmbed's {type, url} shape from events —
-- see EventSocialEmbeds.tsx, which is generic enough to reuse as-is).
--
-- discord_url stays its own column, untouched — it already renders as a
-- prominent "Join Discord" CTA button (not a plain icon link), a different
-- treatment worth keeping distinct from the new plain social_links row.

alter table public.divisions
  add column application_url text,
  add column social_links jsonb not null default '{}'::jsonb,
  add column social_embeds jsonb not null default '[]'::jsonb;

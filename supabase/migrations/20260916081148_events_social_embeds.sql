-- Related Instagram/Discord posts an event admin attaches from EventForm,
-- shown on the event's own page. Instagram posts render as a real oEmbed;
-- Discord has no equivalent embed API for an individual message, so those
-- render as a styled link-out card instead (see EventSocialEmbeds.tsx).
-- Stored as one flexible list rather than two parallel columns since both
-- are "type + url" and the set of platforms may grow later.
alter table public.events add column if not exists social_embeds jsonb not null default '[]'::jsonb;

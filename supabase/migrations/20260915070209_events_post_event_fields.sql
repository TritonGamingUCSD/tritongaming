-- Post-event extras: a Google Photos album link and freeform notes admins can
-- attach once an event has happened, surfaced on the event's public detail
-- page. The existing (previously unused) events.description column is
-- repurposed as the comprehensive "learn more" instructions body for that
-- same page.
alter table public.events
  add column if not exists photo_album_url text,
  add column if not exists post_event_info text;

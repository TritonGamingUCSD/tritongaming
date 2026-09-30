-- The UCSD check-in form's "event name" question doesn't always want the
-- exact public-facing event title (marketing titles vs. UCSD's own
-- registered event name can differ) — this lets an admin override what
-- gets pre-filled there per event. Null/blank falls back to the event's
-- own title (see buildCheckinFormUrl's caller in getTicketsData.ts).
alter table public.events
  add column if not exists checkin_form_event_name text;

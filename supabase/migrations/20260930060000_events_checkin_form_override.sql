-- Lets a rare event use a completely different Google Form instead of the
-- one shared default (see checkin_form_settings) — null (the common case)
-- means "use the site-wide default"; a jsonb object here (same shape as
-- checkin_form_settings' own columns — see CheckinFormConfig in
-- src/lib/checkinForm.ts) fully replaces it for that one event. A single
-- jsonb column rather than 6 more nullable columns on events, since this
-- only ever needs to be read/written as one whole unit (getTicketsData
-- passes it straight to buildCheckinFormUrl), never queried by any
-- individual sub-field.
alter table public.events
  add column if not exists checkin_form_override jsonb;

-- UCSD's required post-check-in compliance form (a Google Form, same one
-- reused all year — see checkin.form content block) isn't needed for every
-- event, so this is a per-event opt-in rather than a blanket "show it for
-- every check-in." checkin_food_item is free text since what's given out
-- varies per event; it's only meaningful when requires_checkin_form is on,
-- but left ungated at the DB level (an event can have leftover text from a
-- time the toggle was on) since the app only ever reads it when the toggle
-- is true anyway.
alter table public.events
  add column if not exists requires_checkin_form boolean not null default false,
  add column if not exists checkin_food_item text;

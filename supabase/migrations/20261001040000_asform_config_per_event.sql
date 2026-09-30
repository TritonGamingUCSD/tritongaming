-- The AS Form link (and its question mapping) changes per event now — UCSD's
-- form is per-event — so the site-wide checkin_form_settings row is no longer
-- read by the app. Copy it into every event that requires the form but
-- doesn't already carry its own config, so those events keep working. The
-- table itself is left in place (unused) rather than dropped.
update public.events e
set checkin_form_override = jsonb_build_object(
  'form_url', s.form_url,
  'entry_event_name', s.entry_event_name,
  'entry_academic_year', s.entry_academic_year,
  'entry_affiliation', s.entry_affiliation,
  'entry_food_item', s.entry_food_item,
  'year_mapping', coalesce(s.year_mapping, '[]'::jsonb),
  'affiliation_mapping', coalesce(s.affiliation_mapping, '[]'::jsonb)
)
from public.checkin_form_settings s
where s.id = 1
  and e.requires_checkin_form
  and e.checkin_form_override is null;

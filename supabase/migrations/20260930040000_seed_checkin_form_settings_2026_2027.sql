-- Real values for the 2026-2027 AS check-in form (see conversation for the
-- source URL). Entry IDs and option text were read directly off the form's
-- own public page (FB_PUBLIC_LOAD_DATA_), never by submitting anything to
-- it. "How did you hear about this event" is deliberately left with no
-- entry ID at all — that one's always left for the attendee to answer
-- themselves, never pre-filled.
--
-- year_mapping only covers 1st-4th Year because the form asks for
-- graduating class ("Class of '27"..."'30"), not relative year standing —
-- this mapping is specific to the 2026-2027 school year and will need
-- updating every fall as the class-of options roll forward. 5th Year+/
-- Graduate/Alumni have no matching class option, so they're left unmapped
-- on purpose (the attendee picks the form's own "Other" option).
update public.checkin_form_settings
set
  form_url = 'https://docs.google.com/forms/d/e/1FAIpQLSc3CypbxjZgU7ZzbhlpEy1XtytmzDquuU4ELmf_VtDRjkDomw/viewform',
  entry_event_name = '219446721',
  entry_academic_year = '1687560837',
  entry_affiliation = '1851239463',
  entry_food_item = '570464428',
  year_mapping = '[
    {"value": "1st Year", "label": "Class of ''30"},
    {"value": "2nd Year", "label": "Class of ''29"},
    {"value": "3rd Year", "label": "Class of ''28"},
    {"value": "4th Year", "label": "Class of ''27"}
  ]'::jsonb,
  affiliation_mapping = '[
    {"value": "exec", "label": "Officer"},
    {"value": "lead", "label": "Officer"},
    {"value": "officer", "label": "Officer"},
    {"value": "division", "label": "Officer"},
    {"value": "ucsd", "label": "Attendee / Prospective Member"},
    {"value": "recruit", "label": "Attendee / Prospective Member"},
    {"value": "alumni", "label": "Attendee / Prospective Member"},
    {"value": "admin", "label": "Attendee / Prospective Member"}
  ]'::jsonb,
  updated_at = now()
where id = 1;

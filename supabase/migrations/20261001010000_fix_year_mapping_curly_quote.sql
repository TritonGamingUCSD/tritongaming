-- The AS Form's first academic-year option is "Class of ‘27" with a *curly*
-- left quote (U+2018), unlike the other three, which use a plain straight
-- apostrophe — Google Forms only pre-selects a choice on an exact string
-- match, so "4th Year" -> "Class of '27" (straight) silently selected
-- nothing. Read straight off the form's own option text, not retyped.
update public.checkin_form_settings
set year_mapping = (
  select jsonb_agg(
    case when elem->>'value' = '4th Year'
      then jsonb_build_object('value', '4th Year', 'label', 'Class of ' || chr(8216) || '27')
      else elem end
  )
  from jsonb_array_elements(year_mapping) as elem
)
where id = 1;

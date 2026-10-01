-- The AS Form's year question is "Class of ‘YY": store its option list on each
-- event's form config so a person's graduation year can be matched to the right
-- option directly (no per-year "3rd Year" -> option mapping to redo each fall).
-- Existing configs get the option list from their current year mapping.
update public.events
set checkin_form_override = jsonb_set(
  checkin_form_override,
  '{year_options}',
  coalesce((
    select jsonb_agg(elem->>'label' order by ord)
    from jsonb_array_elements(checkin_form_override->'year_mapping') with ordinality as t(elem, ord)
    where coalesce(elem->>'label', '') <> ''
  ), '[]'::jsonb)
)
where checkin_form_override is not null
  and not (checkin_form_override ? 'year_options');

-- membership.partners moved from a plain {value,label} kvlist (name +
-- discount text) to an {name,discount,logo_url} imagelist so partners can
-- show their own logo, matching the shape sponsors already uses. Existing
-- rows (seeded in 20260928020000) are migrated in place: value -> name,
-- label -> discount, logo_url left blank (no real partner logos were on
-- hand at seed time — an admin fills them in from the portal).
update public.site_contents
set content = jsonb_set(
  content,
  '{items}',
  (
    select coalesce(jsonb_agg(jsonb_build_object(
      'name', item->>'value',
      'discount', item->>'label',
      'logo_url', ''
    )), '[]'::jsonb)
    from jsonb_array_elements(content->'items') as item
  )
)
where key = 'membership.partners'
  and jsonb_typeof(content->'items') = 'array'
  and jsonb_array_length(content->'items') > 0
  and (content->'items'->0) ? 'value';

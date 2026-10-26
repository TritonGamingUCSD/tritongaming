-- Staffle is opened and closed by hand (no open/close times), and who may enter is a list of roles plus named people.
-- status: draft (not open yet) -> open (taking entries) <-> closed (no more entries) -> drawn -> ended; or cancelled.
alter table public.staffles drop constraint if exists staffles_status_check;
update public.staffles set status = 'closed' where status = 'open' and closes_at <= now();
alter table public.staffles drop column if exists opens_at, drop column if exists closes_at;
alter table public.staffles add constraint staffles_status_check check (status in ('draft', 'open', 'closed', 'drawn', 'ended', 'cancelled'));
alter table public.staffles alter column status set default 'draft';

-- Rules were { in, out, add, block } groups; now { roles, people, skip, block }. Groups ticked in become the closest roles, "add" becomes people, strike and warning groups ticked out become skip.
update public.staffles set rules = jsonb_build_object(
  'roles', case
    when rules->'in' @> '["officer"]'::jsonb and not rules->'in' @> '["recruit"]'::jsonb then '["exec","lead","officer"]'::jsonb
    when rules->'in' @> '["recruit"]'::jsonb and not rules->'in' @> '["officer"]'::jsonb then '["recruit"]'::jsonb
    else '["exec","lead","officer","recruit"]'::jsonb end,
  'people', coalesce(rules->'add', '[]'::jsonb),
  'skip', (select coalesce(jsonb_agg(g), '[]'::jsonb) from jsonb_array_elements_text(coalesce(rules->'out', '[]'::jsonb)) g where g in ('strike', 'warning')),
  'block', coalesce(rules->'block', '[]'::jsonb));

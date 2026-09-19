-- Fills in a gap the divisions_content_fields migration's own comment
-- already anticipated ("manage_division, scoped to a division lead editing
-- only their own division's page") but never actually built: division
-- leads had no RLS policy letting them update their division's row at all,
-- so editing was exec/admin-only in practice despite the capability model
-- already supporting a scoped version. Postgres RLS policies for the same
-- operation are OR'd together (permissive by default), so this just adds a
-- second path alongside the existing exec/admin policy rather than
-- replacing it — exec/admin keep unrestricted access via that one, a
-- division lead gets access only to their own division's row via this one.
-- has_capability('manage_division', id) already does the scoping: true
-- unconditionally for lead/exec/admin, true for a 'division' role holder
-- only when `id` matches their own division_id (see has_capability() in
-- the multi_role_capabilities migration).

create policy "manage_division can update own division content"
  on public.divisions for update
  using (has_capability('manage_division', id))
  with check (has_capability('manage_division', id));

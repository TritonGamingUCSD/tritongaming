-- Division leads can edit their own division's page (see
-- allow_division_leads_edit_own_content) but the division-logos bucket only
-- admitted exec/admin, so their logo upload was rejected by storage RLS.
-- Leads upload under "<division_id>/<file>"; has_capability('manage_division', id)
-- scopes each lead to their own division's folder (exec/admin pass for any).
-- The uuid regex guards the cast so a stray non-uuid folder name is just denied.

create policy "division-logos manage_division insert"
  on storage.objects for insert
  with check (
    bucket_id = 'division-logos'
    and (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and has_capability('manage_division', ((storage.foldername(name))[1])::uuid)
  );

create policy "division-logos manage_division update"
  on storage.objects for update
  using (
    bucket_id = 'division-logos'
    and (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and has_capability('manage_division', ((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'division-logos'
    and (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and has_capability('manage_division', ((storage.foldername(name))[1])::uuid)
  );

create policy "division-logos manage_division delete"
  on storage.objects for delete
  using (
    bucket_id = 'division-logos'
    and (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and has_capability('manage_division', ((storage.foldername(name))[1])::uuid)
  );

-- Two more public buckets for the direct-file-upload pattern introduced for
-- event flyers (see 20260915234451_event_flyers_storage_bucket.sql):
-- division logos (DivisionsManager) and profile pictures (ProfileClient).
insert into storage.buckets (id, name, public)
values
  ('division-logos', 'division-logos', true),
  ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- division-logos: only the divisions directory manager (exec/admin) writes.
create policy "division-logos public read"
  on storage.objects for select
  using (bucket_id = 'division-logos');

create policy "division-logos manage_divisions_directory insert"
  on storage.objects for insert
  with check (bucket_id = 'division-logos' and has_capability('manage_divisions_directory'));

create policy "division-logos manage_divisions_directory update"
  on storage.objects for update
  using (bucket_id = 'division-logos' and has_capability('manage_divisions_directory'))
  with check (bucket_id = 'division-logos' and has_capability('manage_divisions_directory'));

create policy "division-logos manage_divisions_directory delete"
  on storage.objects for delete
  using (bucket_id = 'division-logos' and has_capability('manage_divisions_directory'));

-- avatars: every member manages their own picture only. Uploaded under
-- "<user_id>/<file>" (see uploadImageToStorage's pathPrefix) so RLS can scope
-- writes to the uploader's own folder via storage.foldername().
create policy "avatars public read"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars own insert"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars own update"
  on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars own delete"
  on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

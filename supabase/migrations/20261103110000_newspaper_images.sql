-- Pictures in Newspaper issues: small WebP files made in the browser and uploaded by the route that checks who may edit the issue, so the bucket has no write policy for browsers; reads are public (unguessable file names), because an email's pictures must load for everyone who gets it.
-- The weekly tidy-up finds the files still in use by reading the issues' blocks (a jsonb column), so a sent issue keeps its pictures for good.
-- Additive. Safe to run once.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('newspaper-images', 'newspaper-images', true, 393216, array['image/webp'])
on conflict (id) do update set public = true, file_size_limit = 393216, allowed_mime_types = array['image/webp'];

drop policy if exists "newspaper-images public read" on storage.objects;
create policy "newspaper-images public read" on storage.objects for select using (bucket_id = 'newspaper-images');

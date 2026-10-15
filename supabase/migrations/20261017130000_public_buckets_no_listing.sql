-- These buckets are public, so a file's link works without any policy. The broad "public read" policy only let anyone list every file in the bucket.
-- The app lists buckets only with the service key (storage stats and cleanup), which ignores policies.
drop policy if exists "avatars public read" on storage.objects;
drop policy if exists "division-logos public read" on storage.objects;
drop policy if exists "doc-attachments public read" on storage.objects;
drop policy if exists "event-flyers public read" on storage.objects;
drop policy if exists "site-content public read" on storage.objects;

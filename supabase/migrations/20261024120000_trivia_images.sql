-- An optional picture per Trivia question, shown on the host's big screen (never sent to the phones). Pictures are made small in the browser (WebP, at most about 120 KB) and uploaded by the route that
-- checks who may edit the quiz, so the bucket has no write policies for browsers: reads are public (the pictures are unguessable file names), and the bucket itself refuses anything but WebP over 256 KB.
-- `image` holds the picture's full public address (the weekly storage tidy-up finds files still in use by reading text columns for those addresses).
alter table public.trivia_questions add column if not exists image text not null default '';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('trivia-images', 'trivia-images', true, 262144, array['image/webp'])
on conflict (id) do update set public = true, file_size_limit = 262144, allowed_mime_types = array['image/webp'];

create policy "trivia-images public read"
  on storage.objects for select
  using (bucket_id = 'trivia-images');

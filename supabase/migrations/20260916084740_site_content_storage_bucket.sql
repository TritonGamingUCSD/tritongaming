-- Backs direct-upload 'image' fields in the site content editor (see
-- content-blocks.ts / ContentEditor.tsx) — starting with the Get Involved
-- page's recruitment flyer. Same pattern as event-flyers/division-logos:
-- public read, writes gated by the capability that governs this content.
insert into storage.buckets (id, name, public)
values ('site-content', 'site-content', true)
on conflict (id) do nothing;

create policy "site-content public read"
  on storage.objects for select
  using (bucket_id = 'site-content');

create policy "site-content manage_site_content insert"
  on storage.objects for insert
  with check (bucket_id = 'site-content' and has_capability('manage_site_content'));

create policy "site-content manage_site_content update"
  on storage.objects for update
  using (bucket_id = 'site-content' and has_capability('manage_site_content'))
  with check (bucket_id = 'site-content' and has_capability('manage_site_content'));

create policy "site-content manage_site_content delete"
  on storage.objects for delete
  using (bucket_id = 'site-content' and has_capability('manage_site_content'));

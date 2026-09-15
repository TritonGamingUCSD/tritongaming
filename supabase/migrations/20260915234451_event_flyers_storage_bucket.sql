-- Public bucket for event flyer images, uploaded directly from the event
-- create/edit form (src/app/(portal)/portal/events/EventForm.tsx) instead of
-- pasting an external URL. Flyers are meant to be seen by anyone, so reads
-- are public; only manage_events capability holders can write.
insert into storage.buckets (id, name, public)
values ('event-flyers', 'event-flyers', true)
on conflict (id) do nothing;

create policy "event-flyers public read"
  on storage.objects for select
  using (bucket_id = 'event-flyers');

create policy "event-flyers manage_events insert"
  on storage.objects for insert
  with check (bucket_id = 'event-flyers' and has_capability('manage_events'));

create policy "event-flyers manage_events update"
  on storage.objects for update
  using (bucket_id = 'event-flyers' and has_capability('manage_events'))
  with check (bucket_id = 'event-flyers' and has_capability('manage_events'));

create policy "event-flyers manage_events delete"
  on storage.objects for delete
  using (bucket_id = 'event-flyers' and has_capability('manage_events'));

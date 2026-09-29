-- Replaces events.photo_album_url (one Google Photos link per event) with
-- events.photo_albums (a reorderable jsonb list of {title, url}), matching
-- the same {title,url} shape already used by the portal's standalone
-- photo_albums table and the public Media page's media.albums content
-- block — an event can have more than one album (e.g. one per day of a
-- multi-day LAN), and organizers want to control the display order.
alter table public.events
  add column if not exists photo_albums jsonb not null default '[]';

update public.events
set photo_albums = jsonb_build_array(jsonb_build_object('title', 'Photo Album', 'url', photo_album_url))
where photo_album_url is not null and photo_album_url <> '' and photo_albums = '[]'::jsonb;

alter table public.events drop column if exists photo_album_url;

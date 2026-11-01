-- Photo Booth: every new picture goes in its booth's gallery (a guest can take theirs out), an officer can hide any picture, and downloads are counted.
-- Additive. Pictures already taken keep their current choice. Safe to run once.
alter table public.photobooth_photos alter column shared set default true;
alter table public.photobooth_photos add column if not exists hidden boolean not null default false;   -- an officer hid it from the gallery and the slideshow
alter table public.photobooth_photos add column if not exists downloads integer not null default 0;     -- how many times its file was downloaded

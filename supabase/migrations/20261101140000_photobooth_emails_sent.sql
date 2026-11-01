-- Photo Booth: how many times a picture's link has been emailed (the address itself is never stored), so one picture cannot be used to send a flood of email.
alter table public.photobooth_photos add column if not exists emails_sent int not null default 0;

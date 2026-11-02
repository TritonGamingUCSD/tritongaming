-- Photo Booth: how strongly each picture's brightness and colour are corrected (0 = off, up to 100). Additive. Safe to run once.
alter table public.photobooths add column if not exists auto_adjust smallint not null default 60 check (auto_adjust between 0 and 100);

-- Photo Booth: pictures are always kept 7 days now (the code decides), so a booth no longer has its own number of days. Safe to run once.
alter table public.photobooths drop column if exists keep_days;

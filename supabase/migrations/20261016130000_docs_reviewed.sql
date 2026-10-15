-- Documentation: "last reviewed". An editor marks a page as still correct (even when its text did not change); readers see the date.
alter table public.docs add column if not exists reviewed_at timestamptz;
alter table public.docs add column if not exists reviewed_by uuid references public.profiles(id) on delete set null;

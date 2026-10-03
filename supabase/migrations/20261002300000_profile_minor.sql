-- Optional minor(s), stored like major ("A / B"). Never required.
alter table public.profiles add column if not exists minor text;

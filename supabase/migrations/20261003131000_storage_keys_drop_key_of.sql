-- The club has one storage room, so a key doesn't need a "what it opens" note: its name says whose it is or which copy it is.
alter table public.storage_keys drop column if exists key_of;

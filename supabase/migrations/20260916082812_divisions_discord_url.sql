-- Each division's own Discord server invite, editable from DivisionsManager
-- and shown on that division's public page.
alter table public.divisions add column if not exists discord_url text;

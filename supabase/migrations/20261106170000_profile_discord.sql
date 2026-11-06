-- A linked Discord account's id and username on the profile, kept in step with the account the member linked (set when they sign in or link). The id is what a Discord bot or server role sync would match on. Safe to run once.
alter table public.profiles add column if not exists discord_id text;
alter table public.profiles add column if not exists discord_username text;
create index if not exists profiles_discord_id_idx on public.profiles (discord_id) where discord_id is not null;

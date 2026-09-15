-- Lets members list their Discord handle on their profile, alongside gamer
-- tag/pronouns — purely informational, no format validation (old
-- "name#1234" and new "@username" handles both need to fit).
alter table public.profiles
  add column if not exists discord text;

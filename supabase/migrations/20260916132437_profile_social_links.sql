-- Each member decides which social platforms (if any) to show on their own
-- profile — one flexible jsonb map instead of a column per platform, since
-- the set of platforms is a display/UI concern (icons already exist for
-- Instagram/X/TikTok/Twitch/YouTube/LinkedIn in public/logos, matching the
-- footer) rather than something that needs its own column/index.
alter table public.profiles
  add column if not exists social_links jsonb not null default '{}'::jsonb;

-- Lets a member override their display picture with any URL, without ever
-- touching avatar_url itself (which stays exactly what it's always been —
-- the picture synced from their Google account on sign-in). Wherever a
-- profile picture is shown, custom_avatar_url wins when set and avatar_url
-- is the fallback — see resolveAvatarUrl() in src/lib/profile.ts.
alter table public.profiles
  add column if not exists custom_avatar_url text;

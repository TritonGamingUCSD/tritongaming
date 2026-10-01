-- Portfolio links: shown on the public officer card when the officer opts in
-- (board_visibility.portfolio), so they live on the (public) profiles row next
-- to social_links. Shape: [{ "label": "GitHub", "url": "https://..." }].
alter table public.profiles
  add column if not exists portfolio_links jsonb not null default '[]'::jsonb;

-- Gaming & interest answers (optional) feed the club's own analytics, not other
-- members, so they sit in the owner-only profile_private table with gender.
alter table public.profile_private
  add column if not exists division_interests uuid[] not null default '{}',
  add column if not exists platforms text[] not null default '{}',
  add column if not exists favorite_games text;

alter table public.profile_private drop constraint if exists profile_private_platforms_check;
alter table public.profile_private
  add constraint profile_private_platforms_check
  check (platforms <@ array['PC', 'Console', 'Mobile', 'Tabletop']::text[]);

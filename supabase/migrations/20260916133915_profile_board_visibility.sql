-- Board members (exec/lead auto, officer opt-in via show_on_board) always
-- show name, picture, and org title on the public About page — everything
-- else (bio, gamer tag, year/major, discord, social links) is per-field
-- opt-out, defaulting to visible so nothing existing changes on migrate.
alter table public.profiles
  add column if not exists board_visibility jsonb not null default
    '{"bio":true,"gamer_tag":true,"year_major":true,"discord":true,"socials":true}'::jsonb;

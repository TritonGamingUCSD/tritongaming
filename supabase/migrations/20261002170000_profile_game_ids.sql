-- Game IDs (Steam, Riot ID, Genshin UID...) for the officer card. Like portfolio_links they sit on the
-- profiles row and only show publicly when the officer turns on board_visibility.game_ids.
-- Shape: [{ "game": "Riot ID", "id": "Name#NA1" }].
alter table public.profiles
  add column if not exists game_ids jsonb not null default '[]'::jsonb;

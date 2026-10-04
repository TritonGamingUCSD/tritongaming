-- A big event can carry its own look (colors, fonts, key art, pattern, stickers) from its design guide. Null = the default Triton Gaming look.
alter table public.events add column if not exists theme jsonb;

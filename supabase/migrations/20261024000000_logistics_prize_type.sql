-- A free-text "type" for a prize (what kind of prize it is: a mug, a gift card, a plushie...).
alter table public.logistics_prizes add column if not exists type text;

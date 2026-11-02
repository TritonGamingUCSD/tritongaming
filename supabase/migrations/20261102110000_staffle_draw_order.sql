-- Staffle: the order the prizes are drawn in. Lower numbers are drawn first and people who do not win stay in for every prize drawn after, so entering a cheap prize never costs a chance at a better one. Prizes with the same number are drawn
-- least contested first. Empty means "by value": the most valuable first (prices within 20% count as the same). Additive. Safe to run once.
alter table public.staffle_items add column if not exists draw_order int check (draw_order is null or draw_order between 1 and 99);

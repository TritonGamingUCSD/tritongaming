-- 20260922120000_simplify_leaderboard.sql flipped the old
-- leaderboard_show_name column (which defaulted to true for everyone,
-- back when a separate leaderboard_opt_in gate meant that default rarely
-- mattered) into leaderboard_anonymous. Nobody had actually touched this
-- brand-new per-user preference yet, so every real member just inherited
-- "not anonymous" from that old default instead of the new intended
-- default (anonymous unless they opt out). One-time backfill: reset
-- everyone to the new default, same as a freshly-created profile would get.

begin;

update public.profiles set leaderboard_anonymous = true;

commit;

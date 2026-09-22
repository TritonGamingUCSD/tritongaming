-- Leaderboard redesign: everyone (who's rewards-eligible — see
-- is_rewards_eligible()) is now on it by default, no opt-in required.
-- Exact points are always shown for everyone — no per-user "hide my
-- points" toggle. The only remaining choice is anonymous vs. named,
-- defaulting to anonymous. One `leaderboard_anonymous` column now covers
-- BOTH the member Rewards leaderboard and the officer Battlepass
-- leaderboard (previously Battlepass had no anonymity option at all,
-- always showing full names) — a single "how do I want to appear on
-- leaderboards" preference, not two separate ones per system.
--
-- leaderboard_show_name is renamed (not dropped+recreated) so existing
-- per-user choices carry over, inverted (show_name=true becomes
-- anonymous=false) and re-defaulted to anonymous=true for anyone who
-- never touched it. leaderboard_opt_in and leaderboard_show_points are
-- dropped outright — both concepts no longer exist.

begin;

alter table public.profiles rename column leaderboard_show_name to leaderboard_anonymous;
update public.profiles set leaderboard_anonymous = not leaderboard_anonymous;
alter table public.profiles alter column leaderboard_anonymous set default true;

alter table public.profiles drop column if exists leaderboard_opt_in;
alter table public.profiles drop column if exists leaderboard_show_points;

commit;

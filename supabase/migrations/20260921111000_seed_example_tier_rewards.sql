-- Example tier-unlock rewards for the member Rewards shop, using the
-- perks from the original points-system spec (Discord title/role, extra
-- raffle ticket, fast pass, sticker, membership card). Each is free
-- (point_cost = 0), one-per-person (max_per_user = 1), and gated by
-- min_tier — see 20260921110000_allow_free_tier_unlock_rewards.sql for
-- why that combination is how a tier-unlock perk is expressed. Fast Pass
-- is the actual example the whole digital-reward/grants_fast_pass feature
-- was built for (see 20260921105000_add_digital_rewards.sql) — claiming
-- it auto-fulfills (no officer hand-over) and marks the member's own
-- ticket QR.
begin;

insert into public.reward_items (title, description, point_cost, max_per_user, min_tier, reward_type, grants_fast_pass, active)
values
  ('Discord Title', 'A custom title/role on the Triton Gaming Discord server.', 0, 1, 'Bronze', 'digital', false, true),
  ('Extra Raffle Ticket', 'One additional raffle ticket at events with prizing — show this to an officer at the event.', 0, 1, 'Silver', 'physical', false, true),
  ('Fast Pass', 'Skip the general check-in line at events — shows on your ticket QR automatically.', 0, 1, 'Gold', 'digital', true, true),
  ('Special Sticker', 'A limited-edition Triton Gaming sticker — show this to an officer to claim.', 0, 1, 'Platinum', 'physical', false, true),
  ('Membership Card', 'An official Triton Gaming membership card — show this to an officer to claim.', 0, 1, 'Platinum', 'physical', false, true);

commit;

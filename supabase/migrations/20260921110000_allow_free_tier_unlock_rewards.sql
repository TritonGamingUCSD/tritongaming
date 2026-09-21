-- Lets a reward be free (point_cost = 0) — the vehicle for a tier-unlock
-- perk: combined with min_tier (already existed) and max_per_user = 1
-- (just added), a reward item with 0 cost is something everyone who
-- reaches that tier can claim exactly once, at no points cost. Nothing
-- else about claim_reward/claim_officer_reward needs to change for this —
-- the balance check (`balance < cost`) already passes trivially at
-- cost = 0.
begin;

alter table public.reward_items drop constraint reward_items_point_cost_check;
alter table public.reward_items add constraint reward_items_point_cost_check check (point_cost >= 0);

alter table public.officer_reward_items drop constraint officer_reward_items_point_cost_check;
alter table public.officer_reward_items add constraint officer_reward_items_point_cost_check check (point_cost >= 0);

commit;

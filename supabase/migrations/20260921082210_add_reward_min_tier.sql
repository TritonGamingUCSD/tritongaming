-- Optional minimum-status-tier gate on a shop item (e.g. "Old Merch"
-- only purchasable once Gold+) — the agreed middle ground between tier
-- being pure cosmetic status and a fully separate tier-reward system:
-- one reward mechanism (the shop) still handles everything, tier just
-- gates access to some items.
--
-- Stored as plain text (a tier name, e.g. 'Gold'), not FK-enforced —
-- tiers themselves aren't a database concept, they're a derived value
-- computed from lifetime points (see src/lib/tiers.ts). The gate check
-- happens in the API route (api/rewards/claim), not in SQL, specifically
-- so tier thresholds stay defined in exactly one place instead of being
-- duplicated into a SQL lookup that could drift out of sync with the
-- TypeScript one.

begin;

alter table public.reward_items add column min_tier text;

commit;

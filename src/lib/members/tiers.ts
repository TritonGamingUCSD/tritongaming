import type { SupabaseClient } from '@supabase/supabase-js';

// Status tier thresholds — derived from LIFETIME points earned (never
// decreases even after spending), the "status" half of the points system's
// hybrid model (see the points/rewards migration). Admin-editable via the
// tier_definitions table (20260921120000_add_tier_definitions.sql) and the
// Rewards Manage tab's Tiers sub-tab — the DB is the sole source of truth
// at runtime; every caller fetches the live list (fetchTiers server-side,
// or receives it as a prop client-side) rather than falling back to a
// hardcoded default, because a stale default silently diverging from what
// an admin configured is exactly the failure mode below was written to
// warn about in the first place.
export interface Tier {
  name: string;
  min: number;
  color: string;
}

// getTier()/nextTier() both assume tiers[0].min is 0 (getTier falls back
// to tiers[0] when no real threshold is met; nextTier finds the first tier
// whose min exceeds the caller's points) — the migration's partial unique
// index (`where min_points = 0`) plus admin_upsert_tier/admin_delete_tier
// enforce that exactly one floor tier always exists per system and can't
// be deleted or moved off 0. Without a real 0-point floor, someone with 0
// points got `tier` AND `next` both resolving to the same non-zero tier —
// a zero-width band that broke the progress bar's math (division by zero)
// and, more seriously, made every tier-gated reward look "unlocked" for
// people who hadn't earned a single point.
export function getTier(lifetimePoints: number, tiers: Tier[]): Tier {
  let current = tiers[0];
  for (const tier of tiers) {
    if (lifetimePoints >= tier.min) current = tier;
  }
  return current;
}

export function nextTier(lifetimePoints: number, tiers: Tier[]): Tier | null {
  return tiers.find((t) => t.min > lifetimePoints) ?? null;
}

// Server-side fetch — pass the request's own Supabase client (the select
// RLS policy allows any authenticated read). Always sorted by threshold
// ascending, which getTier/nextTier and every tier-list UI both depend on.
export async function fetchTiers(supabase: SupabaseClient): Promise<Tier[]> {
  const { data } = await supabase
    .from('tier_definitions')
    .select('name, min_points, color')
    .eq('system', 'member')
    .order('min_points');
  return (data ?? []).map((t) => ({ name: t.name, min: t.min_points, color: t.color }));
}

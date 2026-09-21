// Status tier thresholds — derived from LIFETIME points earned (never
// decreases even after spending), the "status" half of the points system's
// hybrid model (see the points/rewards migration). Deliberately a plain
// tunable constant here rather than a DB-editable settings table for V1 —
// easy to adjust without a migration, revisit as a real admin UI only if
// these actually need to change often in practice.
export interface Tier {
  name: string;
  min: number;
  color: string;
}

// 'Member' is a real floor tier (min: 0), not just cosmetic — Bronze no
// longer starts at 0 (it's 300), and getTier()/nextTier() both assume
// TIERS[0].min is 0 (getTier falls back to TIERS[0] when no real
// threshold is met; nextTier finds the first tier whose min exceeds the
// caller's points). Without a real 0-point floor, someone with 0 points
// got `tier` AND `next` both resolving to Bronze — a zero-width band that
// broke the progress bar's math (division by zero) and, more seriously,
// made every Bronze-gated reward look "unlocked" for people who hadn't
// earned a single point.
export const TIERS: Tier[] = [
  { name: 'Member', min: 0, color: '#6b7280' },
  { name: 'Bronze', min: 300, color: '#c17a4d' },
  { name: 'Silver', min: 500, color: '#a8adb8' },
  { name: 'Gold', min: 750, color: '#ffc72c' },
  { name: 'Platinum', min: 1000, color: '#7dd3fc' },
];

export function getTier(lifetimePoints: number): Tier {
  let current = TIERS[0];
  for (const tier of TIERS) {
    if (lifetimePoints >= tier.min) current = tier;
  }
  return current;
}

export function nextTier(lifetimePoints: number): Tier | null {
  return TIERS.find((t) => t.min > lifetimePoints) ?? null;
}

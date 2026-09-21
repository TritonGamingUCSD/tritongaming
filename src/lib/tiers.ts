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

export const TIERS: Tier[] = [
  { name: 'Bronze', min: 0, color: '#c17a4d' },
  { name: 'Silver', min: 100, color: '#a8adb8' },
  { name: 'Gold', min: 300, color: '#ffc72c' },
  { name: 'Platinum', min: 750, color: '#7dd3fc' },
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

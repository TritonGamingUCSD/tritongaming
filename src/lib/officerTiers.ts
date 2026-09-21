import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppRole } from '@/types/database';

// "TG member" — who has a Battlepass at all. Deliberately NOT the same
// set as checkin/manage_events-style "officer-tier" capability gates
// elsewhere: recruit and alumni are included (onboarding/former members
// still get recognized for contributing), but division (a division lead)
// is excluded. 'admin' is excluded too, same reasoning as
// canSetOrgTitle's ORG_TITLE_ROLES in capabilities.ts — it's a platform-
// permissions role, not an org position, so it doesn't imply membership
// on its own (an admin who's also e.g. exec still qualifies through
// that). A single shared constant so this list is never re-typed (and
// re-typed inconsistently) across the API routes and the portal page.
export const BATTLEPASS_ROLES: AppRole[] = ['officer', 'lead', 'exec', 'recruit', 'alumni'];

// Status tiers for the officer points system — a completely separate set
// from src/lib/tiers.ts (the member one), backed by the same
// tier_definitions table under system='officer'. Different names on
// purpose, to reinforce that these are two unrelated currencies or someone
// will naturally assume "Silver" means the same thing in both places.
export interface OfficerTier {
  name: string;
  min: number;
  color: string;
}

export function getOfficerTier(lifetimePoints: number, tiers: OfficerTier[]): OfficerTier {
  let current = tiers[0];
  for (const tier of tiers) {
    if (lifetimePoints >= tier.min) current = tier;
  }
  return current;
}

export function nextOfficerTier(lifetimePoints: number, tiers: OfficerTier[]): OfficerTier | null {
  return tiers.find((t) => t.min > lifetimePoints) ?? null;
}

// See fetchTiers in src/lib/tiers.ts for why this hits the DB every call
// rather than falling back to a hardcoded default.
export async function fetchOfficerTiers(supabase: SupabaseClient): Promise<OfficerTier[]> {
  const { data } = await supabase
    .from('tier_definitions')
    .select('name, min_points, color')
    .eq('system', 'officer')
    .order('min_points');
  return (data ?? []).map((t) => ({ name: t.name, min: t.min_points, color: t.color }));
}

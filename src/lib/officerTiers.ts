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
// from src/lib/tiers.ts (the member one). Different names on purpose, to
// reinforce that these are two unrelated currencies or someone will
// naturally assume "Silver" means the same thing in both places.
export interface OfficerTier {
  name: string;
  min: number;
  color: string;
}

export const OFFICER_TIERS: OfficerTier[] = [
  { name: 'Contributor', min: 0, color: '#a3a3a3' },
  { name: 'Dedicated', min: 100, color: '#60a5fa' },
  { name: 'Veteran', min: 300, color: '#c084fc' },
  { name: 'Legend', min: 800, color: '#ffc72c' },
];

export function getOfficerTier(lifetimePoints: number): OfficerTier {
  let current = OFFICER_TIERS[0];
  for (const tier of OFFICER_TIERS) {
    if (lifetimePoints >= tier.min) current = tier;
  }
  return current;
}

export function nextOfficerTier(lifetimePoints: number): OfficerTier | null {
  return OFFICER_TIERS.find((t) => t.min > lifetimePoints) ?? null;
}

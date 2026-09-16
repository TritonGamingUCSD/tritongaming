import type { AppRole, Capability } from '@/types/database';

export interface RoleGrant {
  role: AppRole;
  division_id: string | null;
}

// Mirrors the `role_capabilities` table + `has_capability()` function seeded
// in supabase/migrations/20260915033819_multi_role_capabilities.sql. Keep
// these in sync — this map drives app-level UI/page gating, the DB table
// drives RLS (the real security boundary).
export const CAPABILITY_ROLES: Record<Capability, AppRole[]> = {
  manage_events: ['officer', 'lead', 'exec', 'admin'],
  delete_events: ['admin'],
  checkin: ['officer', 'lead', 'exec', 'admin'],
  manage_site_content: ['lead', 'exec', 'admin'],
  manage_division: ['division', 'lead', 'exec', 'admin'],
  manage_divisions_directory: ['exec', 'admin'],
  manage_sponsors: ['exec', 'admin'],
  delete_sponsors: ['admin'],
  view_members: ['officer', 'lead', 'exec', 'admin'],
  view_admin_dashboard: ['exec', 'admin'],
  manage_roles: ['admin'],
  // UI-gating only — the QR Studio doesn't write to the database, so unlike
  // every other row here it has no RLS-backed counterpart in the DB's
  // role_capabilities table.
  generate_qr_codes: ['officer', 'division', 'lead', 'exec', 'admin'],
  manage_docs: ['officer', 'lead', 'exec', 'admin'],
};

/**
 * Does this set of role grants include the given capability?
 *
 * `divisionId`, when passed, scopes the 'division' role: a division-role
 * holder only qualifies if it's *their* division. Omit it to ask "does this
 * person hold a capability for any division" (e.g. nav-visibility checks).
 */
export function hasCapability(roles: RoleGrant[], capability: Capability, divisionId?: string): boolean {
  return roles.some((r) => {
    if (r.role === 'admin') return true;
    if (!CAPABILITY_ROLES[capability].includes(r.role)) return false;
    if (r.role === 'division' && divisionId) return r.division_id === divisionId;
    return true;
  });
}

/**
 * Counts as a verified member for UCSD-only event access and free ticket
 * pricing — anyone holding at least one role, including the 'ucsd' badge
 * auto-granted at signup for a @ucsd.edu email. Checked against their actual
 * role grants rather than re-deriving from their live session email, so a
 * role granted manually later (e.g. for someone signed in with a personal
 * email) is honored, and isn't silently overridden by an email check.
 */
export function isVerifiedMember(roles: RoleGrant[]): boolean {
  return roles.length > 0;
}

// Gates the profile's self-set "org title" field (e.g. "Marketing Lead"),
// shown on the Members list. Deliberately excludes 'ucsd' and guest (zero
// roles) — mirrored by a DB trigger (enforce_org_title_permission) that's
// the actual security boundary, since this is UI-only. 'admin' is also
// deliberately excluded — it's a platform-permissions role, not an org
// position, so it doesn't imply any of these on its own (someone can hold
// both, but admin alone doesn't qualify).
const ORG_TITLE_ROLES: AppRole[] = ['officer', 'lead', 'division', 'exec'];

export function canSetOrgTitle(roles: RoleGrant[]): boolean {
  return roles.some((r) => ORG_TITLE_ROLES.includes(r.role));
}

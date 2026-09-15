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
  manage_sponsors: ['exec', 'admin'],
  delete_sponsors: ['admin'],
  view_members: ['officer', 'lead', 'exec', 'admin'],
  view_admin_dashboard: ['exec', 'admin'],
  manage_roles: ['admin'],
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

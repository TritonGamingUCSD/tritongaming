import type { RoleGrant } from './capabilities';

// Who uses which home. Guests (signed in with no role) and students (only the UCSD Student role) live on the main site's own pages (/me); anyone holding another role (recruit, alumni,
// officer, lead, exec, division people, admin) has staff or member tools, so their home is the portal. (Permissions handed to a person appear as `cap:`/`deny:` pseudo-roles and are not roles.)
export function usesPortal(roles: RoleGrant[]): boolean {
  return roles.some((r) => !String(r.role).startsWith('cap:') && !String(r.role).startsWith('deny:') && r.role !== 'ucsd');
}

/** Where a signed-in person starts: the portal for staff and members, /me for students and guests. */
export const homeFor = (roles: RoleGrant[]): string => (usesPortal(roles) ? '/portal' : '/me');

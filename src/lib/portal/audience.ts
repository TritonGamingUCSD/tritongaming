import type { RoleGrant } from './capabilities';

// Who uses which home. Guests (signed in with no role) and students (only the UCSD Student role) live on the main site's own pages (/me); anyone holding another role (recruit, alumni,
// officer, lead, exec, division people, admin) has staff or member tools, so their home is the portal. (Permissions handed to a person appear as `cap:`/`deny:` pseudo-roles and are not roles.)
export function usesPortal(roles: RoleGrant[]): boolean {
  return roles.some((r) => !String(r.role).startsWith('cap:') && !String(r.role).startsWith('deny:') && r.role !== 'ucsd');
}

/** Where a signed-in person starts: the portal for staff and members, /me for students and guests. */
export const homeFor = (roles: RoleGrant[]): string => (usesPortal(roles) ? '/portal' : '/me');

/** Where a student or guest goes instead of a portal hub address: the matching page of /me (tickets, calendar, rewards, profile, help), or Events for the portal's home. Null for anything else (they stay where they are). */
export function meAddressFor(section: string | undefined, tab?: string, subtab?: string): string | null {
  const q = (p: Record<string, string | undefined>) => {
    const s = new URLSearchParams(Object.entries(p).filter((e): e is [string, string] => !!e[1])).toString();
    return s ? `?${s}` : '';
  };
  switch (section) {
    case undefined:
    case '':
    case 'all':
      return '/me/events';
    case 'tickets':
    case 'activity':
      return '/me/tickets';
    case 'calendar':
      return `/me/calendar${q({ view: tab, date: subtab })}`;
    case 'points':
      return `/me/rewards${q({ tab, subtab })}`;
    case 'profile':
      return `/me/profile${q({ tab })}`;
    case 'help':
      return `/me/help${q({ tab, subtab })}`;
    default:
      return null;
  }
}

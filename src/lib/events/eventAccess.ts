import { hasCapability, type RoleGrant } from '@/lib/portal/capabilities';
import { canActInDivision } from '@/lib/portal/divisionAccess';

// Who may do what with ONE event, now that an event belongs either to Triton Gaming (`division_id` empty, every event so far) or to a division. The same rules are in the database (migrations 20261105220000 and
// 20261105230000), which is the real boundary; this is for screens and routes. Exec and admin can do everything with every event.
//   manage   create, edit and publish it
//   checkin  run its check-in desk and scan its tickets
// A Triton Gaming event follows the club's permissions as always. A division's event: its Heads manage it, its Members and Heads check people in, a TG lead or officer does neither (unless exec or admin).
export interface EventOwner {
  division_id: string | null;
}

export function canManageEvent(roles: RoleGrant[], event: EventOwner): boolean {
  if (event.division_id) return canActInDivision(roles, event.division_id, 'head');
  return hasCapability(roles, 'manage_events');
}

export function canCheckInEvent(roles: RoleGrant[], event: EventOwner): boolean {
  if (event.division_id) return canActInDivision(roles, event.division_id, 'member');
  return hasCapability(roles, 'checkin');
}

/** May this person create an event for this owner (null: Triton Gaming)? */
export function canCreateEventFor(roles: RoleGrant[], divisionId: string | null): boolean {
  return canManageEvent(roles, { division_id: divisionId });
}

import type { RoleGrant } from './capabilities';
import { isDivisionRole, type DivisionRole } from '@/types/database';

// Who may do what inside ONE division. Three roles belong to a division (a role row with that division's id): Division Head ('division'), Division Member ('division_member') and Division Alumni
// ('division_alumni'). A person holds at most one of them per division and any number of divisions. Exec and admin have full access to every division. TG roles never reduce division access, and
// division roles never reduce TG access: each stands alone. Plain data and pure functions (no imports from the app), so the rules are easy to test.
export type DivisionLevel = 'head' | 'member' | 'alumni';
const LEVEL_OF: Record<DivisionRole, DivisionLevel> = { division: 'head', division_member: 'member', division_alumni: 'alumni' };
const ROLE_OF: Record<DivisionLevel, DivisionRole> = { head: 'division', member: 'division_member', alumni: 'division_alumni' };
export const divisionRoleOf = (level: DivisionLevel): DivisionRole => ROLE_OF[level];
const RANK: Record<DivisionLevel, number> = { alumni: 1, member: 2, head: 3 };

const isStaff = (roles: RoleGrant[]) => roles.some((r) => r.role === 'exec' || r.role === 'admin');

/** The person's level in one division (their highest if the data ever holds two), or null when they are not in it. Exec and admin are not "in" a division: see canActInDivision. */
export function divisionLevel(roles: RoleGrant[], divisionId: string): DivisionLevel | null {
  let best: DivisionLevel | null = null;
  for (const r of roles) {
    if (!isDivisionRole(r.role) || r.division_id !== divisionId) continue;
    const lvl = LEVEL_OF[r.role];
    if (!best || RANK[lvl] > RANK[best]) best = lvl;
  }
  return best;
}

/** Every division the person belongs to, with their level (for the switcher and the division pages). */
export function myDivisions(roles: RoleGrant[]): { divisionId: string; level: DivisionLevel }[] {
  const ids = [...new Set(roles.filter((r) => isDivisionRole(r.role) && r.division_id).map((r) => r.division_id as string))];
  return ids.map((divisionId) => ({ divisionId, level: divisionLevel(roles, divisionId) as DivisionLevel }));
}

/**
 * May this person act in this division at (at least) this level? Exec and admin can always. A Head can do what a Member can, and a Member what an Alumnus can.
 * An inactive officer or lead is untouched here (inactive only switches off TG powers).
 */
export function canActInDivision(roles: RoleGrant[], divisionId: string, atLeast: DivisionLevel): boolean {
  if (isStaff(roles)) return true;
  const have = divisionLevel(roles, divisionId);
  return !!have && RANK[have] >= RANK[atLeast];
}

/** The same question for "any division at all" (a menu or a page that does not name one yet). */
export function canActInAnyDivision(roles: RoleGrant[], atLeast: DivisionLevel): boolean {
  if (isStaff(roles)) return true;
  return roles.some((r) => isDivisionRole(r.role) && !!r.division_id && RANK[LEVEL_OF[r.role]] >= RANK[atLeast]);
}

// What each level may do in its own division. One place, so a screen and its route cannot disagree. (Exec and admin may do all of it in every division.)
export type DivisionAction =
  | 'see_home' // the division's home in the portal, its roster and announcements
  | 'check_in' // run the check-in desk of the division's events
  | 'run_live_tools' // start Trivia, Polls, Q&A and Photo Booth for the division
  | 'read_docs' // read the division's own documentation
  | 'manage_events' // create and edit the division's events
  | 'edit_page' // the division's public page, board cards, gallery and posts
  | 'manage_members' // add and remove Members and Alumni, answer join requests, switch the join link
  | 'manage_heads' // add and remove other Heads (co-Heads)
  | 'write_docs' // write and edit the division's documentation
  | 'post_announcements' // announcements to the division's members
  | 'request_logistics' // ask for devices and prizes for the division
  | 'see_numbers'; // attendance and analytics of the division's events
const NEEDS: Record<DivisionAction, DivisionLevel> = {
  see_home: 'alumni',
  read_docs: 'alumni',
  see_numbers: 'member',
  check_in: 'member',
  run_live_tools: 'member',
  manage_events: 'head',
  edit_page: 'head',
  manage_members: 'head',
  manage_heads: 'head',
  write_docs: 'head',
  post_announcements: 'head',
  request_logistics: 'head',
};
export const divisionActionNeeds = (action: DivisionAction): DivisionLevel => NEEDS[action];
export const canDivisionAction = (roles: RoleGrant[], divisionId: string, action: DivisionAction): boolean => canActInDivision(roles, divisionId, NEEDS[action]);

import { hasCapability, type RoleGrant } from '@/lib/portal/capabilities';
import { canActInDivision } from '@/lib/portal/divisionAccess';

// Who may do what with ONE tournament. It is owned by Triton Gaming (division_id empty) or by a division, and follows the same rules as events:
//   manage  change settings, entrants and seeds, start it, delete it (Triton Gaming: whoever manages events; a division: its Heads; plus anyone added as an organizer of that tournament)
//   run     enter scores, call matches to stations (manage, plus a division's Members, plus the club's check-in staff)
// Exec and admin can do everything.
// Until tournaments are ready for everyone, only admins can see or use them (the portal page, creating, running, the lists). Turn this off to hand them to Heads and organizers by the rules below.
export const TOURNAMENTS_ADMIN_ONLY = true;

export interface TournamentOwner {
  division_id: string | null;
}

export function canManageTournament(roles: RoleGrant[], t: TournamentOwner, isStaff = false): boolean {
  if (isStaff || hasCapability(roles, 'manage_tournaments')) return true;
  if (TOURNAMENTS_ADMIN_ONLY) return false;
  if (t.division_id) return canActInDivision(roles, t.division_id, 'head');
  return hasCapability(roles, 'manage_events');
}

export function canRunTournament(roles: RoleGrant[], t: TournamentOwner, isStaff = false): boolean {
  if (hasCapability(roles, 'run_tournaments')) return true;
  if (TOURNAMENTS_ADMIN_ONLY) return canManageTournament(roles, t, isStaff);
  if (canManageTournament(roles, t, isStaff)) return true;
  if (t.division_id) return canActInDivision(roles, t.division_id, 'member');
  return hasCapability(roles, 'checkin');
}

export function canCreateTournamentFor(roles: RoleGrant[], divisionId: string | null): boolean {
  return canManageTournament(roles, { division_id: divisionId });
}

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
  // Officer is deliberately excluded from manage_events — they can view the
  // events list (and, via `checkin`, scan tickets) but not create or edit
  // events; that's lead+ only. view_events is the broader read-only gate.
  manage_events: ['lead', 'exec', 'admin'],
  // 'recruit' is mid-onboarding, pre-Officer — read-only access to the
  // events list and docs makes sense before they hold any real position.
  view_events: ['officer', 'lead', 'exec', 'admin', 'recruit', 'alumni'],
  delete_events: ['admin'],
  // recruit can staff check-in before formally becoming Officer.
  checkin: ['officer', 'lead', 'exec', 'admin', 'recruit'],
  // Public marketing copy is an org-wide, exec-tier call — not tied to any
  // one committee a Lead runs, unlike manage_events/manage_docs above.
  manage_site_content: ['exec', 'admin'],
  // A Division Lead edits only their own division (the check is scoped); exec and admin edit any. Leads do not.
  manage_division: ['division', 'exec', 'admin'],
  manage_divisions_directory: ['exec', 'admin'],
  // alumni stay read-only-visible here, same as view_docs.
  view_members: ['officer', 'lead', 'exec', 'admin', 'alumni', 'recruit'],
  // exec deliberately excluded — they get manage_site_content (Edit Site
  // Content) as its own separate section instead of the full Admin
  // Overview/Roles/Analytics/System dashboard.
  view_admin_dashboard: ['admin'],
  manage_roles: ['admin'],
  // UI-gating only — the QR Studio doesn't write to the database, so unlike
  // every other row here it has no RLS-backed counterpart in the DB's
  // role_capabilities table.
  generate_qr_codes: ['officer', 'division', 'lead', 'exec', 'admin', 'recruit', 'alumni'],
  // Same officer-is-view-only split as events: manage_docs (create/edit/
  // delete) is lead+, view_docs (read) keeps officer (and recruit) in.
  manage_docs: ['lead', 'exec', 'admin'],
  view_docs: ['officer', 'lead', 'exec', 'admin', 'recruit', 'alumni'],
  // Creating/editing/retiring shop items —
  // tightened to exec+ only, same bar as manage_points' "correction-level
  // ops decisions are exec+" reasoning below.
  manage_rewards_shop: ['exec', 'admin'],
  // Scanning a member's redemption QR and confirming a reward was handed
  // over — same audience as checkin, since it happens at the same events
  // check-in already staffs.
  scan_redemptions: ['officer', 'lead', 'exec', 'admin', 'recruit'],
  // Anything that moves points around after the fact — reversing a
  // check-in/redemption, undoing someone's attendance at an event, or a
  // free-form manual adjustment. Deliberately tighter than checkin/
  // scan_redemptions/manage_rewards_shop (which include officer/lead):
  // those cover the routine, in-the-moment actions; this covers correcting
  // them later, which the club wants reserved for exec+. UI-gating only,
  // same as generate_qr_codes — every route it protects goes through a
  // service-role RPC, so the API route's own check is the real boundary,
  // not an RLS policy keyed to this capability.
  manage_points: ['exec', 'admin'],
  // The order exec appear on the public Team page and in TG Members.
  manage_board_order: ['exec', 'admin'],
  // Weekly Gen Meeting: only exec (and admin) can open check-in and show the code; everyone on the
  // team — recruits included — can check themselves in by typing it. UI/API gating only (the
  // meeting routes use the service role, so these routes are the real boundary).
  manage_meetings: ['exec', 'admin'],
  // Help tickets: everyone signed in can ask; exec and admin see every ticket and answer them.
  manage_help: ['exec', 'admin'],
  // Meeting attendance results for everyone (the Attendance tab with absences and reasons, check-in times and
  // the HR CSV export). Read-only. Exec and admin by default; can be granted to a person or group (Admin → Access).
  view_attendance_reports: ['exec', 'admin'],
  // The strike tracker (private). Exec and the HR team (the "manage strikes" permission, handed out in Admin → Access) and admins see everyone's strikes,
  // add them directly (no approval), take them away, and handle vouchers. Leads and officers have no part in it. Everyone tracked always sees their own strikes. UI/API gating only.
  manage_strikes: ['exec', 'admin'],
  // Quarter status: exec and admin mark officers and leads inactive for a quarter (and see the yearly records). Setting up the quarter dates themselves is admin only
  // (manage_roles). UI/API gating only (the routes use the service role).
  manage_quarters: ['exec', 'admin'],
  // The Division Members directory (who leads each division): the whole team can look —
  // officers, leads, exec and recruits — plus the division leads themselves. Editing divisions is
  // separate (manage_divisions_directory / manage_division). Emails come with view_members (officers, leads, exec, recruits and alumni).
  view_division_members: ['division', 'officer', 'lead', 'exec', 'admin', 'recruit', 'alumni'],
  attend_meetings: ['officer', 'lead', 'exec', 'admin', 'recruit'],
  // Planning a meeting: leads can create meetings and run/edit/see results of the ones THEY planned;
  // exec and admin (manage_meetings) can do all of that for every meeting.
  host_meetings: ['lead', 'exec', 'admin'],
  // Logistics (equipment, prizes, requests, event plans): every recruit, officer and above can look at everything; only people who manage it can change anything.
  // manage_logistics is exec and admin by default and can be handed to a person or group (Admin → Access). Submitting a request and the event-day steps are open to
  // every officer (checked by their own routes). Deliberately separate from check-in. UI/API gating only (the routes use the service role).
  view_logistics: ['recruit', 'officer', 'lead', 'exec', 'admin'],
  // A division account sees only the Requests pages (its division's requests, and submitting new ones): nothing else in Logistics.
  request_logistics: ['recruit', 'officer', 'division', 'lead', 'exec', 'admin'],
  manage_logistics: ['exec', 'admin'],
};

// What being inactive takes away: anything that manages, hosts or deletes, plus checking in and scanning redemptions. Attending meetings is NOT stripped: roles never
// pull an inactive person into a meeting, but one added by name (or planning one they were asked about) must still work (see isExpectedActive). Everything else (view_*, QR codes, their own profile) stays.
export function isInactiveStripped(capability: string): boolean {
  return /^(manage|host|delete)_/.test(capability) || capability === 'checkin' || capability === 'scan_redemptions';
}

/** A member of the TG team in the wide sense: exec, lead, officer, recruit or alumni (and admins). Used for team-wide views (what the team is allowed to see together). */
export const isTgMember = (roles: RoleGrant[]): boolean => roles.some((r) => (['exec', 'lead', 'officer', 'recruit', 'alumni', 'admin'] as string[]).includes(r.role));

/**
 * Does this set of role grants include the given capability?
 *
 * `divisionId`, when passed, scopes the 'division' role: a division-role
 * holder only qualifies if it's *their* division. Omit it to ask "does this
 * person hold a capability for any division" (e.g. nav-visibility checks).
 */
export function hasCapability(roles: RoleGrant[], capability: Capability, divisionId?: string): boolean {
  // An inactive officer or lead keeps every viewing permission and loses the ones that change or run things (admins are never affected).
  if (isInactiveStripped(capability) && roles.some((r) => r.role === 'inactive') && !roles.some((r) => r.role === 'admin')) return false;
  return roles.some((r) => {
    if (r.role === 'admin') return true;
    // A permission granted straight to the person or one of their groups (see withGrantedCapabilities).
    if ((r.role as string) === `cap:${capability}`) return true;
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

// Rewards (points earned at check-in, and the shop) are for UCSD students only: someone whose only role is "UCSD Student". Holding any other
// role (recruit, alumni, officer, lead, exec, division lead, admin) means no points and no Rewards section of their own, and a person with no role (guest)
// is not a student, so they have none either. Exec and admin still see Rewards to run it (see page.tsx). Mirrors is_rewards_eligible() in
// 20261015110000_rewards_students_only.sql, which is what actually stops points being awarded; this keeps the section and leaderboard in step with it.
// (Permissions handed to a person directly appear as `cap:` pseudo-roles and are not roles.)
export function isRewardsEligible(roles: RoleGrant[]): boolean {
  const held = roles.filter((r) => !String(r.role).startsWith('cap:'));
  return held.some((r) => r.role === 'ucsd') && held.every((r) => r.role === 'ucsd');
}

// Gates the profile's self-set "org title" field (e.g. "Marketing Lead"),
// shown on the Members list. Deliberately excludes 'ucsd' and guest (zero
// roles) — mirrored by a DB trigger (enforce_org_title_permission) that's
// the actual security boundary, since this is UI-only. 'admin' is also
// deliberately excluded — it's a platform-permissions role, not an org
// position, so it doesn't imply any of these on its own (someone can hold
// both, but admin alone doesn't qualify).
const ORG_TITLE_ROLES: AppRole[] = ['officer', 'lead', 'exec'];

export function canSetOrgTitle(roles: RoleGrant[]): boolean {
  return roles.some((r) => ORG_TITLE_ROLES.includes(r.role));
}

/** A title is required for leads and exec only; officers may add one but are never asked for it. */
export function requiresOrgTitle(roles: RoleGrant[]): boolean {
  return roles.some((r) => r.role === 'lead' || r.role === 'exec');
}

// Permissions that can be handed to a person or group on top of their role (Admin → Access). Only for things
// that are otherwise exec/admin-only (so far: meeting attendance reports); everything the team's roles already
// cover is not grantable. Roles, points, stats and site content stay role-only.
export const GRANTABLE_CAPABILITIES: { id: Capability; label: string; description: string }[] = [
  { id: 'manage_strikes', label: 'Strikes (HR team)', description: 'See every officer’s, lead’s and exec’s strikes and vouchers, add strikes directly, review missed meetings, take strikes away, and give or remove vouchers, always with a reason the person can read. Exec already have this. Very private, and nobody can change their own record.' },
  { id: 'manage_logistics', label: 'Event Logistics', description: 'Add and edit equipment, prizes and sponsors, plan events and manage the Event Logistics lists. Every officer can already look at Logistics; this is what lets someone change it.' },
  { id: 'view_attendance_reports', label: 'Meeting attendance reports', description: 'See every meeting’s attendance results, absences and reasons, check-in times, and download the HR CSV export. View only.' },
];

// Adds the permissions someone was granted directly to their role list, so every existing
// hasCapability() check just works. Used wherever roles are loaded.
export function withGrantedCapabilities(roles: RoleGrant[], granted: Capability[]): RoleGrant[] {
  return [...roles, ...granted.map((c) => ({ role: `cap:${c}` as unknown as AppRole, division_id: null }))];
}

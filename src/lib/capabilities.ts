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
  // calendar and docs makes sense before they hold any real position.
  view_events: ['officer', 'lead', 'exec', 'admin', 'recruit'],
  delete_events: ['admin'],
  // recruit can staff check-in before formally becoming Officer.
  checkin: ['officer', 'lead', 'exec', 'admin', 'recruit'],
  // Public marketing copy is an org-wide, exec-tier call — not tied to any
  // one committee a Lead runs, unlike manage_events/manage_docs above.
  manage_site_content: ['exec', 'admin'],
  manage_division: ['division', 'lead', 'exec', 'admin'],
  manage_divisions_directory: ['exec', 'admin'],
  // alumni stay read-only-visible here, same as view_photo_albums/view_docs.
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
  // The 'division' role is deliberately NOT here — a division lead role alone
  // doesn't grant album access (they'd need officer or higher for that).
  // Alumni and recruit are explicitly included here (unlike view_docs/
  // view_events, which exclude alumni) — browsing old event photos is
  // exactly the kind of thing a former member or a not-yet-onboarded
  // prospect would want, unlike day-to-day ops docs or the events calendar.
  view_photo_albums: ['officer', 'lead', 'exec', 'admin', 'recruit', 'alumni'],
  manage_photo_albums: ['lead', 'exec', 'admin'],
  // Creating/editing/retiring shop items (member Rewards and Battlepass) —
  // tightened to exec+ only, same bar as manage_points' "correction-level
  // ops decisions are exec+" reasoning below.
  manage_rewards_shop: ['exec', 'admin'],
  // Scanning a member's redemption QR and confirming a reward was handed
  // over — same audience as checkin, since it happens at the same events
  // check-in already staffs.
  scan_redemptions: ['officer', 'lead', 'exec', 'admin'],
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
  // Weekly Gen Meeting: only exec (and admin) can open check-in and show the code; everyone on the
  // team — recruits included — can check themselves in by typing it. UI/API gating only (the
  // meeting routes use the service role, so these routes are the real boundary).
  manage_meetings: ['exec', 'admin'],
  // Help tickets: everyone signed in can ask; exec and admin see every ticket and answer them.
  manage_help: ['exec', 'admin'],
  // Internal events (socials, recruitment training…; separate from meetings): the team can see the ones they're invited to
  // and say if they're coming; leads, exec and admin can plan them (leads manage their own, exec and admin all).
  // Meeting attendance results for everyone (the Attendance tab with absences and reasons, check-in times and
  // the HR CSV export). Read-only. Exec and admin by default; can be granted to a person or group (Admin → Access).
  view_attendance_reports: ['exec', 'admin'],
  view_internal_events: ['officer', 'lead', 'exec', 'admin', 'recruit'],
  // Storage keys (who has which key right now): the whole team can see them and say they have one or give one to someone (view_keys).
  // Only exec and admin can add, rename or delete a key (manage_keys). UI/API gating only (the key routes use the service role).
  view_keys: ['officer', 'lead', 'exec', 'admin', 'recruit'],
  manage_keys: ['exec', 'admin'],
  // The strike tracker (private). Exec and the HR team (the "manage strikes" permission, handed out in Admin → Access) and admins see everyone's strikes,
  // add them directly (no approval), take them away, and handle vouchers. Leads and officers have no part in it. Everyone tracked always sees their own strikes. UI/API gating only.
  manage_strikes: ['exec', 'admin'],
  // Quarter status: exec and admin mark officers and leads inactive for a quarter (and see the yearly records). Setting up the quarter dates themselves is admin only
  // (manage_roles). UI/API gating only (the routes use the service role).
  manage_quarters: ['exec', 'admin'],
  host_internal_events: ['lead', 'exec', 'admin'],
  manage_internal_events: ['exec', 'admin'],
  // The Division Members directory (who leads each division): the whole team can look —
  // officers, leads, exec and recruits — plus the division leads themselves. Editing divisions is
  // separate (manage_divisions_directory / manage_division). Emails on it stay officer+ (view_members).
  view_division_members: ['division', 'officer', 'lead', 'exec', 'admin', 'recruit'],
  attend_meetings: ['officer', 'lead', 'exec', 'admin', 'recruit'],
  // Planning a meeting: leads can create meetings and run/edit/see results of the ones THEY planned;
  // exec and admin (manage_meetings) can do all of that for every meeting.
  host_meetings: ['lead', 'exec', 'admin'],
};

// What being inactive takes away: anything that manages, hosts or deletes, plus checking in and scanning redemptions. Attending meetings is NOT stripped: roles never
// pull an inactive person into a meeting, but one added by name (or planning one they were asked about) must still work (see isExpectedActive). Everything else (view_*, QR codes, storage keys, their own profile) stays.
export function isInactiveStripped(capability: string): boolean {
  return /^(manage|host|delete)_/.test(capability) || capability === 'checkin' || capability === 'scan_redemptions';
}

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

// Rewards (points earned at check-in, referral bonuses, the shop) is
// restricted to current UCSD students and club staff — mirrors
// is_rewards_eligible() in 20260922110000_restrict_rewards_to_ucsd.sql,
// the actual enforcement boundary (award_checkin_points/claim_reward);
// this is UI-gating only. 'ucsd' covers verified students; the org
// position roles are included since holding one for a UCSD club implies
// current UCSD affiliation even without an auto-verified @ucsd.edu email.
// Recruits and alumni are included too (the club opened Rewards to them) — the DB function
// is_rewards_eligible() mirrors this list (see 20261002160000_role_visibility.sql).
const REWARDS_ELIGIBLE_ROLES: AppRole[] = ['ucsd', 'officer', 'lead', 'exec', 'division', 'admin', 'recruit', 'alumni'];

export function isRewardsEligible(roles: RoleGrant[]): boolean {
  return roles.some((r) => REWARDS_ELIGIBLE_ROLES.includes(r.role));
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

// Permissions that can be handed to a person or group on top of their role (Admin → Access). Only for things
// that are otherwise exec/admin-only (so far: meeting attendance reports); everything the team's roles already
// cover is not grantable. Roles, points, stats and site content stay role-only.
export const GRANTABLE_CAPABILITIES: { id: Capability; label: string; description: string }[] = [
  { id: 'manage_strikes', label: 'Strikes (HR team)', description: 'See every officer’s, lead’s and exec’s strikes and vouchers, add strikes directly, review missed meetings, take strikes away, and give or remove vouchers, always with a reason the person can read. Exec already have this. Very private, and nobody can change their own record.' },
  { id: 'view_attendance_reports', label: 'Meeting attendance reports', description: 'See every meeting’s attendance results, absences and reasons, check-in times, and download the HR CSV export. View only.' },
];

// Adds the permissions someone was granted directly to their role list, so every existing
// hasCapability() check just works. Used wherever roles are loaded.
export function withGrantedCapabilities(roles: RoleGrant[], granted: Capability[]): RoleGrant[] {
  return [...roles, ...granted.map((c) => ({ role: `cap:${c}` as unknown as AppRole, division_id: null }))];
}

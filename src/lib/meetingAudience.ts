// Who a meeting is for. It is the UNION of up to three live sources:
//   • roles   — everyone currently holding one of the roles (`audience`; null = the default team roles
//               when nothing else is chosen)
//   • groups  — everyone currently in each saved group (`group_ids`)
//   • people  — individually added people (`invitees`)
// Roles and groups are pulled in live (someone promoted or added to a group later is included), so the
// server resolves groups into `extra_ids` (invitees + group members) before asking who is expected.
// Client-safe: used by the portal UI and the API routes alike.

export const AUDIENCE_ROLES = ['exec', 'lead', 'officer', 'recruit'] as const;
export type AudienceRole = (typeof AUDIENCE_ROLES)[number];
export const DEFAULT_AUDIENCE: AudienceRole[] = ['exec', 'lead', 'officer', 'recruit'];
export const MAX_INVITEES = 300;
export const MAX_GROUPS = 20;

export const AUDIENCE_LABELS: Record<AudienceRole, string> = { exec: 'Exec', lead: 'Leads', officer: 'Officers', recruit: 'Recruits' };

export interface MeetingAudience {
  audience: string[] | null;
  invitees?: string[] | null;
  group_ids?: string[] | null;
  /** Server-resolved: invitees plus the current members of every group. */
  extra_ids?: string[];
}

const same = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));
// Someone chose people or groups (the resolved extra_ids count too, so callers that only pass those still get it right).
export const hasExtras = (m: MeetingAudience) => !!(m.invitees?.length || m.group_ids?.length || m.extra_ids?.length);

// The roles that count, live. With no explicit roles: everyone-on-the-team, unless people/groups were
// chosen instead (then no roles).
export function audienceRoles(m: Pick<MeetingAudience, 'audience' | 'invitees' | 'group_ids' | 'extra_ids'>): string[] {
  if (m.audience && m.audience.length) return m.audience;
  return hasExtras(m) ? [] : DEFAULT_AUDIENCE;
}

// Everyone resolved on the server (groups expanded). Falls back to the plain invitees on the client.
const extraIds = (m: MeetingAudience) => m.extra_ids ?? m.invitees ?? [];

export function audienceLabel(m: MeetingAudience & { groupNames?: string[] }): string {
  const roles = audienceRoles(m);
  const parts: string[] = [];
  if (roles.length) {
    parts.push(same(roles, DEFAULT_AUDIENCE) ? (hasExtras(m) ? 'Everyone on the team' : 'Everyone') : AUDIENCE_ROLES.filter((r) => roles.includes(r)).map((r) => AUDIENCE_LABELS[r]).join(', '));
  }
  if (m.group_ids?.length) parts.push(m.groupNames?.length ? m.groupNames.join(' + ') : `${m.group_ids.length} group${m.group_ids.length === 1 ? '' : 's'}`);
  if (m.invitees?.length) parts.push(`${m.invitees.length} added ${m.invitees.length === 1 ? 'person' : 'people'}`);
  return parts.join(' + ') || 'Everyone';
}
// Is it something other than the plain "everyone on the team" default?
export const isCustomAudience = (m: MeetingAudience) => hasExtras(m) || !!(m.audience && m.audience.length);

// Is this person someone the meeting EXPECTS? (Counts toward its attendance.)
export function isExpected(m: MeetingAudience, userId: string, roles: { role: string }[]): boolean {
  if (extraIds(m).includes(userId)) return true;
  const want = audienceRoles(m);
  return roles.some((r) => want.includes(r.role));
}

// May this person check in? Only people the meeting is for (by role, group or being added). Exec and
// admins get no exception: running a meeting doesn't mean attending it. (An exec can still add someone
// by hand from the live screen.)
export function canAttendMeeting(m: MeetingAudience, userId: string, roles: { role: string }[]): boolean {
  return isExpected(m, userId, roles);
}

const UUID = /^[0-9a-f-]{36}$/i;
function cleanIds(raw: unknown, max: number): string[] | null {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) return null;
  const ids = [...new Set(raw.map(String))];
  return ids.length <= max && ids.every((i) => UUID.test(i)) ? ids : null;
}

// Validates audience input from a form and returns what to store.
export function validateAudienceInput(b: { audience?: unknown; invitees?: unknown; group_ids?: unknown }):
  { ok: true; audience: string[] | null; invitees: string[] | null; group_ids: string[] | null } | { ok: false } {
  const invitees = cleanIds(b.invitees, MAX_INVITEES);
  const groups = cleanIds(b.group_ids, MAX_GROUPS);
  if (!invitees || !groups) return { ok: false };
  let roles: string[] = [];
  if (b.audience !== undefined && b.audience !== null) {
    if (!Array.isArray(b.audience)) return { ok: false };
    roles = [...new Set(b.audience.map(String))];
    if (!roles.every((r) => (AUDIENCE_ROLES as readonly string[]).includes(r))) return { ok: false };
  }
  const extras = invitees.length > 0 || groups.length > 0;
  if (roles.length === 0 && !extras) return { ok: true, audience: null, invitees: null, group_ids: null };  // default: everyone
  // With people/groups chosen, the roles list is explicit (an empty list = no roles, stored as null).
  // Without extras, the default set collapses to null.
  const storedRoles = roles.length === 0 ? null : (!extras && same(roles, DEFAULT_AUDIENCE) ? null : roles);
  return { ok: true, audience: storedRoles, invitees: invitees.length ? invitees : null, group_ids: groups.length ? groups : null };
}

// Validates a list of profile ids from the client (for groups). null = invalid.
export function cleanMemberIds(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const ids = [...new Set(raw.map(String))];
  return ids.length <= MAX_INVITEES && ids.every((i) => UUID.test(i)) ? ids : null;
}

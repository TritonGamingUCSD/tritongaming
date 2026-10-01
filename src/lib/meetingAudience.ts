// Who a meeting is for. Either a hand-picked list of people (`invitees`), or — when that's empty —
// everyone holding one of a set of roles (`audience`; null = everyone on the team).
// Client-safe: used by the portal UI and the API routes alike.

export const AUDIENCE_ROLES = ['exec', 'lead', 'officer', 'recruit'] as const;
export type AudienceRole = (typeof AUDIENCE_ROLES)[number];
export const DEFAULT_AUDIENCE: AudienceRole[] = ['exec', 'lead', 'officer', 'recruit'];
export const MAX_INVITEES = 300;

export const AUDIENCE_LABELS: Record<AudienceRole, string> = { exec: 'Exec', lead: 'Leads', officer: 'Officers', recruit: 'Recruits' };

export const AUDIENCE_PRESETS: { label: string; roles: AudienceRole[] }[] = [
  { label: 'Everyone', roles: DEFAULT_AUDIENCE },
  { label: 'Exec & leads', roles: ['exec', 'lead'] },
  { label: 'No recruits', roles: ['exec', 'lead', 'officer'] },
];

export interface MeetingAudience { audience: string[] | null; invitees?: string[] | null }

export function audienceRoles(a: string[] | null | undefined): string[] {
  return a && a.length ? a : DEFAULT_AUDIENCE;
}
const same = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));
export const hasInvitees = (m: MeetingAudience) => !!m.invitees && m.invitees.length > 0;

export function audienceLabel(m: MeetingAudience): string {
  if (hasInvitees(m)) return `${m.invitees!.length} invited ${m.invitees!.length === 1 ? 'person' : 'people'}`;
  const roles = audienceRoles(m.audience);
  const preset = AUDIENCE_PRESETS.find((p) => same(p.roles, roles));
  if (preset) return preset.label;
  return AUDIENCE_ROLES.filter((r) => roles.includes(r)).map((r) => AUDIENCE_LABELS[r]).join(', ');
}
// Is it something other than the plain "everyone on the team" default?
export const isCustomAudience = (m: MeetingAudience) => hasInvitees(m) || !!m.audience;

// Is this person someone the meeting EXPECTS? (Counts toward its attendance.)
export function isExpected(m: MeetingAudience, userId: string, roles: { role: string }[]): boolean {
  if (hasInvitees(m)) return m.invitees!.includes(userId);
  const want = audienceRoles(m.audience);
  return roles.some((r) => want.includes(r.role));
}

// May this person check in? Admins always can; everyone else must be expected.
export function canAttendMeeting(m: MeetingAudience, userId: string, roles: { role: string }[]): boolean {
  return roles.some((r) => r.role === 'admin') || isExpected(m, userId, roles);
}

// Validates audience input from a form. Returns what to store: a hand-picked list wins; otherwise
// roles (empty or the default set → null = everyone on the team).
export function validateAudienceInput(b: { audience?: unknown; invitees?: unknown }): { ok: true; audience: string[] | null; invitees: string[] | null } | { ok: false } {
  if (Array.isArray(b.invitees) && b.invitees.length > 0) {
    const ids = [...new Set(b.invitees.map(String))];
    if (ids.length > MAX_INVITEES || !ids.every((i) => /^[0-9a-f-]{36}$/i.test(i))) return { ok: false };
    return { ok: true, audience: null, invitees: ids };
  }
  const raw = b.audience;
  if (raw === null || raw === undefined) return { ok: true, audience: null, invitees: null };
  if (!Array.isArray(raw)) return { ok: false };
  const roles = [...new Set(raw.map(String))];
  if (roles.length === 0) return { ok: true, audience: null, invitees: null };
  if (!roles.every((r) => (AUDIENCE_ROLES as readonly string[]).includes(r))) return { ok: false };
  return { ok: true, audience: same(roles, DEFAULT_AUDIENCE) ? null : roles, invitees: null };
}

// Validates a list of profile ids from the client (for groups). null = invalid.
export function cleanMemberIds(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const ids = [...new Set(raw.map(String))];
  return ids.length <= MAX_INVITEES && ids.every((i) => /^[0-9a-f-]{36}$/i.test(i)) ? ids : null;
}

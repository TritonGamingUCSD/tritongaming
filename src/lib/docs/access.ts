import type { RoleGrant } from '@/lib/portal/capabilities';

// Who may read and who may edit a doc, as two lists of entries. An entry says who it lets in: everyone, anyone signed in, everyone with a role, a team, one person, or a division's Heads, Members or Alumni (one division, or any).
// Exec and admin always have access. Anyone who may edit a doc may also read it. Plain data and pure functions, so the screens, the routes and the tests agree.
export type DivisionRole = 'division' | 'division_member' | 'division_alumni';
export type AccessEntry =
  | { t: 'everyone' }
  | { t: 'signed_in' }
  | { t: 'role'; role: string }
  | { t: 'team'; id: string }
  | { t: 'person'; id: string; name?: string }
  | { t: 'division'; role: DivisionRole; division_id: string | null };

export interface AccessContext {
  userId: string | null;
  roles: RoleGrant[];
  teamIds: string[];
}

const DIVISION_ROLES: DivisionRole[] = ['division', 'division_member', 'division_alumni'];

export function matches(e: AccessEntry, ctx: AccessContext): boolean {
  switch (e.t) {
    case 'everyone':
      return true;
    case 'signed_in':
      return !!ctx.userId;
    case 'role':
      return ctx.roles.some((r) => (r.role as string) === e.role);
    case 'team':
      return ctx.teamIds.includes(e.id);
    case 'person':
      return !!ctx.userId && ctx.userId === e.id;
    case 'division':
      return ctx.roles.some((r) => (r.role as string) === e.role && (e.division_id === null || r.division_id === e.division_id));
  }
}

const isStaff = (ctx: AccessContext) => ctx.roles.some((r) => r.role === 'exec' || r.role === 'admin');

export const canAccess = (entries: AccessEntry[] | null | undefined, ctx: AccessContext): boolean => isStaff(ctx) || (entries ?? []).some((e) => matches(e, ctx));
export const canRead = (read: AccessEntry[] | null | undefined, edit: AccessEntry[] | null | undefined, ctx: AccessContext): boolean =>
  canAccess(read, ctx) || canAccess(edit, ctx);

/** What a new division doc starts with: read by its Heads and Members, edited by its Heads. */
export function divisionDefaults(divisionId: string): { read: AccessEntry[]; edit: AccessEntry[] } {
  return {
    read: [
      { t: 'division', role: 'division', division_id: divisionId },
      { t: 'division', role: 'division_member', division_id: divisionId },
    ],
    edit: [{ t: 'division', role: 'division', division_id: divisionId }],
  };
}

/** What a new club doc starts with: read by the roles that can see documentation, edited by the roles that manage it. */
export function clubDefaults(): { read: AccessEntry[]; edit: AccessEntry[] } {
  return {
    read: ['officer', 'lead', 'exec', 'admin', 'recruit', 'alumni'].map((role) => ({ t: 'role' as const, role })),
    edit: ['lead', 'exec', 'admin'].map((role) => ({ t: 'role' as const, role })),
  };
}

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROLE = /^[a-z_]{2,30}$/;

/** Entries from whatever came in, keeping only well-formed ones (no duplicates, at most 40). */
export function cleanEntries(input: unknown): AccessEntry[] {
  if (!Array.isArray(input)) return [];
  const out: AccessEntry[] = [];
  const seen = new Set<string>();
  for (const x of input.slice(0, 80)) {
    const e = x as Record<string, unknown>;
    let entry: AccessEntry | null = null;
    if (e?.t === 'everyone') entry = { t: 'everyone' };
    else if (e?.t === 'signed_in') entry = { t: 'signed_in' };
    else if (e?.t === 'role' && typeof e.role === 'string' && ROLE.test(e.role) && !DIVISION_ROLES.includes(e.role as DivisionRole)) entry = { t: 'role', role: e.role };
    else if (e?.t === 'team' && typeof e.id === 'string' && ID.test(e.id)) entry = { t: 'team', id: e.id };
    else if (e?.t === 'person' && typeof e.id === 'string' && ID.test(e.id))
      entry = { t: 'person', id: e.id, ...(typeof e.name === 'string' && e.name.trim() ? { name: e.name.trim().slice(0, 60) } : {}) };
    else if (e?.t === 'division' && DIVISION_ROLES.includes(e.role as DivisionRole) && (e.division_id === null || (typeof e.division_id === 'string' && ID.test(e.division_id))))
      entry = { t: 'division', role: e.role as DivisionRole, division_id: e.division_id as string | null };
    if (!entry) continue;
    const k = JSON.stringify(entry.t === 'person' ? { t: 'person', id: entry.id } : entry);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(entry);
    if (out.length >= 40) break;
  }
  return out;
}

/** Whether a list lets the public (or every signed-in person) in. Only a division's Heads and staff may do that. */
export const opensWide = (entries: AccessEntry[]): boolean => entries.some((e) => e.t === 'everyone' || e.t === 'signed_in');

/** The coarse label kept in `audience` for the public page and the list: public, everyone in the division, Members and Heads, or Heads only. */
export function audienceOf(read: AccessEntry[], divisionId: string): 'heads' | 'members' | 'division' | 'public' {
  if (read.some((e) => e.t === 'everyone')) return 'public';
  const has = (role: DivisionRole) => read.some((e) => e.t === 'division' && e.role === role && (e.division_id === divisionId || e.division_id === null));
  if (has('division_alumni')) return 'division';
  if (has('division_member')) return 'members';
  return 'heads';
}

/** A sentence for a list, given names for teams, people and divisions: "Heads of this division, the Tech team, Jasper". */
export function describeEntries(
  entries: AccessEntry[],
  names: { team?: (id: string) => string; person?: (id: string) => string; division?: (id: string) => string; roleLabel?: (role: string) => string },
  thisDivision?: string,
): string {
  if (entries.length === 0) return 'Nobody (except exec and admin)';
  return entries
    .map((e) => {
      switch (e.t) {
        case 'everyone':
          return 'Everyone (public)';
        case 'signed_in':
          return 'Everyone signed in';
        case 'role':
          return `${names.roleLabel?.(e.role) ?? e.role} role`;
        case 'team':
          return `${names.team?.(e.id) ?? 'A team'} team`;
        case 'person':
          return e.name ?? names.person?.(e.id) ?? 'A person';
        case 'division': {
          const who = e.role === 'division' ? 'Heads' : e.role === 'division_member' ? 'Members' : 'Alumni';
          const of = e.division_id === null ? 'of any division' : e.division_id === thisDivision ? 'of this division' : `of ${names.division?.(e.division_id) ?? 'a division'}`;
          return `${who} ${of}`;
        }
      }
    })
    .join(', ');
}

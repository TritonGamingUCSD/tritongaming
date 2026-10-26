// Who may enter a Staffle. The rules are set per Staffle: groups ticked in (a person must be in one of them), groups ticked out (a person in any is left out), and named people added (always in) or blocked
// (always out). Pure logic (no database); the routes read a person's facts and ask here.

export const GROUPS = [
  { id: 'officer', label: 'Officers', hint: 'Officers, leads, exec and admins' },
  { id: 'recruit', label: 'Recruits', hint: 'Recruits who have not become officers' },
  { id: 'active', label: 'Active members', hint: 'On the team and not marked inactive this quarter' },
  { id: 'inactive', label: 'Inactive members', hint: 'Marked inactive this quarter' },
  { id: 'strike', label: 'People with strikes', hint: 'One or more strikes (not just the warning)' },
  { id: 'warning', label: 'People with a warning', hint: 'Exactly the first mark, a warning' },
] as const;
export type Group = (typeof GROUPS)[number]['id'];
export const isGroup = (v: unknown): v is Group => GROUPS.some((g) => g.id === v);

export interface Rules { in: Group[]; out: Group[]; add: string[]; block: string[] }
export const NO_RULES: Rules = { in: [], out: [], add: [], block: [] };

// A person as the rules see them: their roles and how many marks (a warning counts as the first) are on their record.
export interface Person { id: string; roles: string[]; marks: number }

export function groupsOf(p: Pick<Person, 'roles' | 'marks'>): Group[] {
  const has = (r: string) => p.roles.includes(r);
  const officer = ['officer', 'lead', 'exec', 'admin'].some(has);
  const team = officer || has('recruit');
  const out: Group[] = [];
  if (officer) out.push('officer');
  if (has('recruit') && !officer) out.push('recruit');
  if (has('inactive')) out.push('inactive');
  else if (team) out.push('active');
  if (p.marks >= 2) out.push('strike');
  if (p.marks === 1) out.push('warning');
  return out;
}

const UUID = /^[0-9a-f-]{36}$/i;
// Reads the rules a client sent: only known groups and well-formed ids.
export function cleanRules(raw: unknown): Rules {
  const r = (raw ?? {}) as Record<string, unknown>;
  const list = <T,>(v: unknown, ok: (x: unknown) => x is T): T[] => [...new Set((Array.isArray(v) ? v : []).filter(ok))];
  const id = (x: unknown): x is string => typeof x === 'string' && UUID.test(x);
  return { in: list(r.in, isGroup), out: list(r.out, isGroup), add: list(r.add, id).slice(0, 500), block: list(r.block, id).slice(0, 500) };
}

// Can this person enter, and if not, why (in words a person can act on).
export function canEnter(rules: Rules, p: Person): { ok: true } | { ok: false; why: string } {
  if (rules.block.includes(p.id)) return { ok: false, why: 'You were left out of this Staffle by name.' };
  if (rules.add.includes(p.id)) return { ok: true };
  const mine = groupsOf(p);
  const hit = rules.out.find((g) => mine.includes(g));
  if (hit) return { ok: false, why: `This Staffle is not open to ${GROUPS.find((g) => g.id === hit)!.label.toLowerCase()}.` };
  if (rules.in.length && !rules.in.some((g) => mine.includes(g))) return { ok: false, why: `This Staffle is only open to ${rules.in.map((g) => GROUPS.find((x) => x.id === g)!.label.toLowerCase()).join(' and ')}.` };
  return { ok: true };
}

// A line for the Staffle's card: who it is open to.
export function rulesText(rules: Rules, names: Map<string, string> = new Map()): string {
  const label = (g: Group) => GROUPS.find((x) => x.id === g)!.label.toLowerCase();
  const parts = [rules.in.length ? `Open to ${rules.in.map(label).join(' and ')}` : 'Open to all staff'];
  if (rules.out.length) parts.push(`not ${rules.out.map(label).join(' or ')}`);
  if (rules.add.length) parts.push(`plus ${rules.add.map((id) => names.get(id) ?? 'someone').join(', ')}`);
  if (rules.block.length) parts.push(`except ${rules.block.map((id) => names.get(id) ?? 'someone').join(', ')}`);
  return parts.join(', ');
}

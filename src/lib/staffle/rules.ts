import { AUDIENCE_LABELS, AUDIENCE_ROLES, type AudienceRole } from '@/lib/meetings/meetingAudience';

// Who may enter a Staffle: the roles ticked and the people picked by name (the same way a meeting's audience is chosen, without the teams). Pure logic (no database); the routes read a person's roles and ask here.

// Left out, whatever their role: people with strikes (one or more marks past the warning), people with a warning (exactly the first mark), and anyone named.
export const SKIPS = [
  { id: 'strike', label: 'People with strikes', hint: 'Two or more marks on their record (the warning is the first)' },
  { id: 'warning', label: 'People with a warning', hint: 'Exactly one mark, the warning' },
] as const;
export type Skip = (typeof SKIPS)[number]['id'];

export interface Rules {
  roles: AudienceRole[];
  people: string[];
  skip: Skip[];
  block: string[];
}
export const NO_RULES: Rules = { roles: [...AUDIENCE_ROLES], people: [], skip: [], block: [] };

// A person as the rules see them: their roles and how many marks (a warning counts as the first) are on their record.
export interface Person {
  id: string;
  roles: string[];
  marks: number;
}

const UUID = /^[0-9a-f-]{36}$/i;
// Reads the rules a client sent: only known roles and well-formed ids.
export function cleanRules(raw: unknown): Rules {
  const r = (raw ?? {}) as Record<string, unknown>;
  const list = <T>(v: unknown, ok: (x: unknown) => x is T): T[] => [...new Set((Array.isArray(v) ? v : []).filter(ok))];
  const role = (x: unknown): x is AudienceRole => AUDIENCE_ROLES.some((a) => a === x);
  const skip = (x: unknown): x is Skip => SKIPS.some((a) => a.id === x);
  const id = (x: unknown): x is string => typeof x === 'string' && UUID.test(x);
  return { roles: list(r.roles, role), people: list(r.people, id).slice(0, 500), skip: list(r.skip, skip), block: list(r.block, id).slice(0, 500) };
}

// A Staffle needs someone who can enter.
export const rulesEmpty = (rules: Rules) => rules.roles.length === 0 && rules.people.length === 0;

// Can this person enter, and if not, why (in words a person can act on). An inactive member is always out (even by name); then left out by name; then named people are in; then strikes and warnings are left out; then the roles. Like a meeting, a role does not pull in an alumnus; only a name does.
export function canEnter(rules: Rules, p: Person): { ok: true } | { ok: false; why: string } {
  if (p.roles.includes('inactive')) return { ok: false, why: 'Inactive members can’t enter a Staffle.' };
  if (rules.block.includes(p.id)) return { ok: false, why: 'You were left out of this Staffle by name.' };
  if (rules.people.includes(p.id)) return { ok: true };
  if (rules.skip.includes('strike') && p.marks >= 2) return { ok: false, why: 'This Staffle is not open to people with strikes.' };
  if (rules.skip.includes('warning') && p.marks === 1) return { ok: false, why: 'This Staffle is not open to people with a warning.' };
  const idle = p.roles.includes('alumni');
  if (!idle && rules.roles.some((r) => p.roles.includes(r))) return { ok: true };
  const who = rules.roles.map((r) => AUDIENCE_LABELS[r].toLowerCase());
  return {
    ok: false,
    why:
      idle && rules.roles.some((r) => p.roles.includes(r))
        ? 'Alumni can only enter when they are picked by name.'
        : `This Staffle is only open to ${who.length ? who.join(' and ') : 'the people picked'}.`,
  };
}

// A line for the Staffle's card: who it is open to.
export function rulesText(rules: Rules, names: Map<string, string> = new Map()): string {
  const roles = rules.roles.length === AUDIENCE_ROLES.length ? 'everyone on the team' : rules.roles.map((r) => AUDIENCE_LABELS[r].toLowerCase()).join(' and ');
  const people = rules.people.map((id) => names.get(id) ?? 'someone').join(', ');
  const out = [...rules.skip.map((s) => SKIPS.find((x) => x.id === s)!.label.toLowerCase()), ...rules.block.map((id) => names.get(id) ?? 'someone')];
  return `Open to ${[roles, people].filter(Boolean).join(' + ')}${out.length ? `, not ${out.join(' or ')}` : ''}`;
}

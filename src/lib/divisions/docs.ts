import type { DivisionLevel } from '@/lib/portal/divisionAccess';

// Who reads a division doc: only Heads, Members and Heads, everyone in the division (Alumni too), or the public (also on the division's public page).
export const DOC_AUDIENCES = ['heads', 'members', 'division', 'public'] as const;
export type DocAudience = (typeof DOC_AUDIENCES)[number];

export const AUDIENCE_LABEL: Record<DocAudience, string> = {
  heads: 'Heads only',
  members: 'Members and Heads',
  division: 'Everyone in the division',
  public: 'Public',
};

const NEEDS: Record<DocAudience, DivisionLevel> = { heads: 'head', members: 'member', division: 'alumni', public: 'alumni' };
const RANK: Record<DivisionLevel, number> = { alumni: 1, member: 2, head: 3 };

/** May someone at this level in the division read a doc with this audience? */
export function docVisibleTo(audience: DocAudience, level: DivisionLevel): boolean {
  return RANK[level] >= RANK[NEEDS[audience]];
}

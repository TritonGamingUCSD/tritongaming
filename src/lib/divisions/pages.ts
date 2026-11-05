import type { DivisionLevel } from '@/lib/portal/divisionAccess';

// The pages of a division in the portal (what its sidebar lists), and which level may open each. Plain data. The first level in `needs` is the lowest that may open it; exec and admin ('staff') open all.
// Home and the roster are for everyone in the division; check-in and Live Tools for Members and Heads; the rest is for Heads.
export interface DivisionPage {
  id: string;
  label: string;
  needs: DivisionLevel;
}
export const DIVISION_PAGES: readonly DivisionPage[] = [
  { id: 'home', label: 'Home', needs: 'alumni' },
  { id: 'events', label: 'Events', needs: 'head' },
  { id: 'check-in', label: 'Check-In', needs: 'member' },
  { id: 'live', label: 'Live Tools', needs: 'member' },
  { id: 'members', label: 'Members', needs: 'alumni' },
  { id: 'docs', label: 'Docs', needs: 'alumni' },
  { id: 'page', label: 'Page', needs: 'head' },
  { id: 'settings', label: 'Settings', needs: 'head' },
];
const RANK: Record<DivisionLevel, number> = { alumni: 1, member: 2, head: 3 };
/** The pages a person at this level sees ('staff' is exec and admin: every page). */
export const divisionPagesFor = (level: DivisionLevel | 'staff'): DivisionPage[] => DIVISION_PAGES.filter((p) => level === 'staff' || RANK[level] >= RANK[p.needs]);
export const isDivisionPageId = (id: string | null | undefined): id is string => !!id && DIVISION_PAGES.some((p) => p.id === id);

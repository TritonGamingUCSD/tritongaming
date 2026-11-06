import type { DivisionLevel } from '@/lib/portal/divisionAccess';

// The pages of a division in the portal (what its sidebar lists), and which level may open each. Plain data. The first level in `needs` is the lowest that may open it; exec and admin ('staff') open all.
// Home and the roster are for everyone in the division; check-in and Live Tools for Members and Heads; the rest is for Heads.
export interface DivisionPage {
  id: string;
  label: string;
  needs: DivisionLevel;
  /** Which sidebar group it sits in (the same groups, icons and colors as the club's sidebar). Home has none: the logo at the top is home. */
  group?: 'Events' | 'Run' | 'Team' | 'Outreach';
  /** Feature switches that must all be on for this page to show (see featureSwitches.ts). */
  switches?: string[];
}
export const DIVISION_PAGES: readonly DivisionPage[] = [
  { id: 'home', label: 'Home', needs: 'alumni' },
  { id: 'events', label: 'Events', needs: 'head', group: 'Events' },
  { id: 'check-in', label: 'Check-In', needs: 'member', group: 'Events' },
  { id: 'qr', label: 'QR Codes', needs: 'member', group: 'Outreach' },
  { id: 'tournaments', label: 'Tournaments', needs: 'member', group: 'Events', switches: ['div_tournaments', 'tournaments'] },
  { id: 'trivia', label: 'Trivia', needs: 'member', group: 'Run', switches: ['div_live', 'trivia'] },
  { id: 'polls', label: 'Polls', needs: 'member', group: 'Run', switches: ['div_live', 'polls'] },
  { id: 'qa', label: 'Q&A', needs: 'member', group: 'Run', switches: ['div_live', 'qa'] },
  { id: 'photobooth', label: 'Photo Booth', needs: 'member', group: 'Run', switches: ['div_live', 'photobooth'] },
  { id: 'broadcast', label: 'Broadcast', needs: 'member', group: 'Run', switches: ['div_broadcast', 'broadcast'] },
  { id: 'members', label: 'Members', needs: 'alumni', group: 'Team' },
  { id: 'docs', label: 'Docs', needs: 'alumni', group: 'Team' },
  { id: 'page', label: 'Page', needs: 'head', group: 'Outreach' },
];
const RANK: Record<DivisionLevel, number> = { alumni: 1, member: 2, head: 3 };
/** The pages a person at this level sees ('staff' is exec and admin: every page). */
export const divisionPagesFor = (level: DivisionLevel | 'staff', off: string[] = []): DivisionPage[] =>
  DIVISION_PAGES.filter((p) => (level === 'staff' || RANK[level] >= RANK[p.needs]) && !(p.switches ?? []).some((k) => off.includes(k)));
export const isDivisionPageId = (id: string | null | undefined): id is string => !!id && DIVISION_PAGES.some((p) => p.id === id);

/** The sidebar groups of a division: the same four groups, in the same order and with the same names, colors and icons as the club's sidebar (Events, Live Tools, Club, Content), with only the pages this level may open. */
export const DIVISION_GROUP_LABEL = { Events: 'Events', Run: 'Live Tools', Team: 'Club', Outreach: 'Content' } as const;
export function divisionSidebar(level: DivisionLevel | 'staff', off: string[] = []): { group: 'Events' | 'Run' | 'Team' | 'Outreach'; label: string; items: DivisionPage[] }[] {
  const pages = divisionPagesFor(level, off).filter((p) => p.group);
  return (['Events', 'Run', 'Team', 'Outreach'] as const)
    .map((group) => ({ group, label: DIVISION_GROUP_LABEL[group], items: pages.filter((p) => p.group === group) }))
    .filter((g) => g.items.length > 0);
}

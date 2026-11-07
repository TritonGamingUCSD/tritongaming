// The bottom tab bar's slots aren't fixed: see dockPicker.ts for how sections are chosen.
import { SECTION_IDS } from '@/lib/portal/sections';

// Section icons are already sized for the big grid cards (28px) — shrink
// to something that reads as a tab-bar glyph instead of cloning a whole
// second icon set just for this.
// The bottom bar's icons should look the same size, not just be the same size: the calendar glyphs fill their box more than the ticket does, so they are drawn a little smaller
// and the ticket a little larger.
export const DOCK_ICON_SIZE: Record<string, number> = { meetings: 19, events: 19, tickets: 22 };

// Fixed display order — a section's own `group` string just needs to match
// one of these keys. Anything with a group not listed here (shouldn't
// happen, but not worth a hard crash over) falls into its own "More"
// bucket at the end rather than silently vanishing.
// 'Tools' used to be its own group with exactly one card (QR Studio) in
// it — a group that never clusters more than a single item isn't helping
// anyone scan faster, it's just an extra label to read past. QR Studio
// moved into Outreach instead (see portal/page.tsx) — it's usable by any
// officer-tier member, the same audience as Members/Docs, not Admin's
// actually-restricted stuff.
// 'Overview' is the unlabeled group right under Dashboard (Profile and Help, which have no sidebar entry of their own).
export const GROUP_ORDER = ['Overview', 'Yours', 'Events', 'Run', 'Team', 'Outreach', 'Admin'] as const;

// Order inside each group (and so in the sidebar, the "More" sheet and the home grid). Anything not
// listed goes last, in the order it was given.
// The order and the names of the sections are defined once, in lib/portal/sections.ts.
// (Grouped by job: Events plans an event, Live Tools holds what runs while it happens, Club is meetings, people and standing, Outreach is how the club reaches people (email, QR codes, the public website), Admin is the portal's own settings.)
const WANTED_ORDER = [
  'tickets',
  'calendar',
  'points',
  'activity',
  'profile',
  'events',
  'checkin',
  'tournaments',
  'broadcast',
  'logistics',
  'trivia',
  'polls',
  'qa',
  'photobooth',
  'staffle',
  'meetings',
  'members',
  'division-members',
  'divisions',
  'quarters',
  'strikes',
  'docs',
  'newsletter',
  'qrcode',
  'site-content',
  'help',
  'admin',
];
export const SECTION_ORDER = [...WANTED_ORDER, ...SECTION_IDS.filter((id) => !WANTED_ORDER.includes(id))];

// Accent color per group — tints the heading dot, icon tiles and hover state.
// The Dashboard is soft white, so it does not read as part of the blue "Yours" or "Events" groups.
export const DASHBOARD_ACCENT = '#e5e7eb';

export const GROUP_ACCENT: Record<string, string> = {
  Overview: DASHBOARD_ACCENT,
  Yours: '#4a90d9',
  Events: '#e8912d',
  Run: '#d9573a',
  Team: '#8b6cdc',
  Outreach: '#3aa6c9',
  Admin: '#d9487f',
};

// Names shown for each group: what you are doing, not who is allowed.
export const GROUP_LABEL: Record<string, string> = {
  Overview: 'Portal',
  Yours: 'Me',
  Events: 'Events',
  Run: 'Live Tools',
  Team: 'Club',
  Outreach: 'Content',
  Admin: 'Admin',
};

// Params that belong to whatever was open, cleared when switching sections.
export const CLEAR_NAV = { tab: null, subtab: null, block: null, id: null, q: null, status: null, view: null, atype: null, aq: null, ticket: null, plan: null };

export const SPRING = { type: 'spring' as const, stiffness: 420, damping: 38 };

// Below this, PortalHub renders the mobile experience: a card grid that
// zooms into a full-screen panel on tap, one screen at a time — correct for
// a small display where there's no room for anything to stay persistently
// on screen. Above it, a persistent sidebar takes over (see DesktopShell) —
// having *both* a sidebar and a full-page card takeover competing as two
// different navigation ideas at once was exactly what read as inconsistent/
// "mobile design stretched wide" on desktop. Chosen to match the rail's own
// CSS breakpoint (PortalHub.module.css) so JS and CSS never disagree about
// which mode is active.
export const DESKTOP_BREAKPOINT = '(min-width: 900px)';

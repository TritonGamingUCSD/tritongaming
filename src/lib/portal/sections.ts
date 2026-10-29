// The portal's sections, defined ONCE. Everything that needs to know "which sections are there, what are they called, in what order, what is their first tab, what does the search offer" reads this list:
// the portal's addresses (portalPath.ts), the next.config.ts rewrites, the sidebar order and the "needs a role" notice (PortalHub.tsx), the first tab of each section (usePortalTabSync.ts), the search's
// "Go to" entries (portalCommands.ts) and the docs table (npm run docs:sync). To add a section: add one entry here, and one block in app/(portal)/portal/page.tsx that says who may open it and what it shows.
// Plain data only (no imports): next.config.ts reads this file directly.

export interface SectionDef {
  id: string;                       // the address word: /portal/<id>
  label: string;                    // its name in the sidebar, the search and the "needs a role" notice
  mainTab?: string;                 // the first tab: its address is the section's own (/portal/<id>), with no tab word
  address?: boolean;                // true when the section has no page of its own in page.tsx (only an address that opens another one)
  search?: { hint: string; keywords: string[]; caps?: string[]; id?: string };   // the "Go to" entry in the portal search (`caps`: any one of them opens it)
}

// The order of the list is the order in the sidebar, the More sheet and the home grid (inside each group).
export const SECTIONS: SectionDef[] = [
  { id: 'tickets', label: 'My Tickets', mainTab: 'tickets', search: { hint: 'Your event tickets and history', keywords: ['qr', 'ticket', 'history', 'activity', 'registered'] } },
  { id: 'points', label: 'Rewards', mainTab: 'mine', search: { hint: 'Points and the shop', keywords: ['points', 'shop', 'perks', 'redeem'] } },
  { id: 'activity', label: 'Activity', address: true },
  { id: 'profile', label: 'Profile', mainTab: 'info', search: { hint: 'Your info and preferences', keywords: ['account', 'settings', 'me', 'name', 'picture', 'avatar'] } },
  { id: 'events', label: 'Events', mainTab: 'list', search: { hint: 'Create and manage events', keywords: ['event', 'manage'], caps: ['view_events'] } },
  { id: 'checkin', label: 'Check-In', mainTab: 'tickets', search: { hint: 'Enter a ticket code, the event QR, the online code', keywords: ['scan', 'scanner', 'qr'], caps: ['checkin'] } },
  { id: 'members', label: 'TG Members', mainTab: 'members', search: { hint: 'Everyone in the org', keywords: ['people', 'directory', 'roster', 'team'], caps: ['view_members'] } },
  { id: 'meetings', label: 'Meetings', mainTab: 'mine', search: { hint: 'Check in, history and results', keywords: ['meeting', 'attendance'], caps: ['attend_meetings', 'view_attendance_reports'] } },
  { id: 'logistics', label: 'Event Logistics', mainTab: 'home', search: { hint: 'Equipment catalog, prizes and event setups', keywords: ['equipment', 'devices', 'gear', 'inventory', 'prizes', 'shelf', 'setup', 'tech'], caps: ['view_logistics', 'manage_logistics'] } },
  { id: 'staffle', label: 'Staffle', search: { hint: 'Enter the staff raffle and see who won', keywords: ['raffle', 'lottery', 'draw', 'win', 'prizes', 'giveaway'], caps: ['view_logistics', 'manage_logistics'] } },
  { id: 'quarters', label: 'Quarter status', search: { hint: 'Who is active or inactive each quarter', keywords: ['quarter', 'inactive', 'active', 'officer', 'term', 'year'], caps: ['manage_quarters'] } },
  { id: 'strikes', label: 'Strikes', search: { hint: 'Private strike tracker (HR and exec)', keywords: ['strike', 'strikes', 'voucher', 'hr', 'attendance'], caps: ['manage_strikes'] } },
  { id: 'trivia', label: 'Trivia', search: { hint: 'Join a quiz game, or write and host one', keywords: ['quiz', 'kahoot', 'game', 'questions', 'play', 'join'] } },
  { id: 'divisions', label: 'Divisions', search: { hint: 'Edit the divisions directory and pages', keywords: ['division', 'edit'], caps: ['manage_divisions_directory', 'manage_division'] } },
  { id: 'division-members', label: 'Division Members', search: { hint: 'Who leads each division', keywords: ['leads', 'division'], caps: ['view_division_members'] } },
  { id: 'docs', label: 'Documentation', search: { hint: 'How-to guides', keywords: ['guide', 'help', 'how to', 'docs'], caps: ['view_docs'] } },
  { id: 'qrcode', label: 'QR Studio', search: { id: 'qr', hint: 'Design branded QR codes', keywords: ['qr', 'code', 'generator'], caps: ['generate_qr_codes'] } },
  { id: 'help', label: 'Help', search: { hint: 'Ask a question or report a problem', keywords: ['support', 'question', 'bug', 'problem', 'ticket'] } },
  { id: 'admin', label: 'Admin', mainTab: 'overview', search: { hint: 'Stats, roles, analytics and audit history', keywords: ['roles', 'stats', 'audit', 'system'], caps: ['view_admin_dashboard'] } },
  { id: 'site-content', label: 'Site Content', search: { hint: 'Edit the public website', keywords: ['website', 'cms', 'banners', 'text', 'images'], caps: ['manage_site_content'] } },
];

export const SECTION_IDS = SECTIONS.map((s) => s.id);
export const sectionLabel = (id: string) => SECTIONS.find((s) => s.id === id)?.label ?? id;
export const MAIN_TABS: Record<string, string> = Object.fromEntries(SECTIONS.filter((s) => s.mainTab).map((s) => [s.id, s.mainTab!]));

// The docs table of the sections, made from the list above (npm run docs:sync writes it into docs/code-map.md; a test fails when the docs have drifted).
export const sectionsDoc = (): string => [
  '| Address | Name | First tab | In the search |',
  '| --- | --- | --- | --- |',
  ...SECTIONS.map((s) => `| \`/portal/${s.id}\` | ${s.label} | ${s.mainTab ?? '-'} | ${s.search ? `${s.search.hint}${s.search.caps ? ` (needs ${s.search.caps.join(' or ')})` : ''}` : s.address ? 'an address only (no page of its own)' : '-'} |`),
].join('\n');
export const DOC_START = '<!-- sections:start (made by npm run docs:sync from src/lib/portal/sections.ts; do not edit by hand) -->';
export const DOC_END = '<!-- sections:end -->';

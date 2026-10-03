import { hasCapability, isRewardsEligible, type RoleGrant } from '@/lib/capabilities';
import { BATTLEPASS_ROLES } from '@/lib/officerTiers';
import type { Capability } from '@/types/database';

// Sections and actions the portal search can jump to. Filtered by what the person can actually open, so the
// search never offers something that would just say "no access".
export interface PortalCommand { id: string; label: string; hint: string; href: string; kind: 'Go to' | 'Do'; keywords: string[] }

interface Def extends PortalCommand { cap?: Capability | Capability[]; test?: (roles: RoleGrant[]) => boolean }

const S = (id: string, label: string, hint: string, section: string, keywords: string[], cap?: Def['cap'], test?: Def['test']): Def =>
  ({ id: `go-${id}`, label, hint, href: `/portal?section=${section}`, kind: 'Go to', keywords, cap, test });
const A = (id: string, label: string, hint: string, href: string, keywords: string[], cap?: Def['cap'], test?: Def['test']): Def =>
  ({ id: `do-${id}`, label, hint, href, kind: 'Do', keywords, cap, test });

const DEFS: Def[] = [
  { id: 'go-home', label: 'Dashboard', hint: 'Your home screen', href: '/portal', kind: 'Go to', keywords: ['home', 'overview'] },
  S('calendar', 'Calendar', 'Events, meetings and internal events', 'calendar', ['schedule', 'dates', 'month']),
  S('tickets', 'My Tickets', 'Your event tickets and history', 'tickets', ['qr', 'ticket', 'history', 'activity', 'registered']),
  S('points', 'Rewards', 'Points and the shop', 'points', ['points', 'shop', 'perks', 'redeem'], undefined, (r) => isRewardsEligible(r)),
  S('events', 'Events', 'Create and manage events', 'events', ['event', 'manage'], 'view_events'),
  S('checkin', 'Check-In', 'Scan tickets and reveal the online code', 'checkin', ['scan', 'scanner', 'qr'], 'checkin'),
  S('members', 'TG Members', 'Everyone in the org', 'members', ['people', 'directory', 'roster', 'team'], 'view_members'),
  S('meetings', 'Meetings', 'Check in, history and results', 'meetings', ['meeting', 'attendance'], ['attend_meetings', 'view_attendance_reports']),
  S('internal', 'Internal Events', 'Socials, trainings and workshops for the team', 'internal-events', ['social', 'training', 'workshop', 'hangout', 'rsvp'], 'view_internal_events'),
  S('battlepass', 'Battlepass', 'Officer recognition points', 'battlepass', ['points', 'tier'], undefined, (r) => r.some((x) => BATTLEPASS_ROLES.includes(x.role))),
  S('keys', 'Storage Keys', 'Who has each storage key', 'keys', ['key', 'keys', 'storage', 'closet', 'lock'], 'view_keys'),
  S('strikes', 'Strikes', 'Private strike tracker (HR and exec)', 'strikes', ['strike', 'strikes', 'voucher', 'hr', 'attendance'], ['manage_strikes']),
  S('divisions', 'Divisions', 'Edit the divisions directory and pages', 'divisions', ['division', 'edit'], ['manage_divisions_directory', 'manage_division']),
  S('division-members', 'Division Members', 'Who leads each division', 'division-members', ['leads', 'division'], 'view_division_members'),
  S('docs', 'Documentation', 'How-to guides', 'docs', ['guide', 'help', 'how to', 'docs'], 'view_docs'),
  S('qr', 'QR Studio', 'Design branded QR codes', 'qrcode', ['qr', 'code', 'generator'], 'generate_qr_codes'),
  S('albums', 'Photo Albums', 'Albums from past events', 'albums', ['photos', 'pictures', 'google photos'], 'view_photo_albums'),
  S('profile', 'Profile', 'Your info and preferences', 'profile', ['account', 'settings', 'me', 'name', 'picture', 'avatar']),
  S('help', 'Help', 'Ask a question or report a problem', 'help', ['support', 'question', 'bug', 'problem', 'ticket']),
  S('admin', 'Admin', 'Stats, roles, analytics and audit history', 'admin', ['roles', 'stats', 'audit', 'system'], 'view_admin_dashboard'),
  S('site-content', 'Site Content', 'Edit the public website', 'site-content', ['website', 'cms', 'banners', 'text', 'images'], 'manage_site_content'),

  A('help-new', 'Ask for help', 'Open a help ticket', '/portal?section=help&tab=new', ['support', 'question', 'bug', 'problem', 'report', 'ticket']),
  A('profile-edit', 'Edit my profile', 'Name, major, games, picture', '/portal?section=profile', ['update', 'change', 'name', 'major', 'college']),
  A('game-ids', 'Add my game IDs', 'Steam, Riot ID, Genshin UID…', '/portal?section=profile&tab=officer', ['steam', 'riot', 'genshin', 'discord', 'gamertag', 'username'], 'view_members'),
  A('security', 'Login & security', 'Linked Google accounts, sign out', '/portal?section=profile&tab=security', ['google', 'password', 'sign out', 'logout', 'account']),
  A('calendar-subscribe', 'Subscribe to my calendar', 'Add it to Google or Apple Calendar', '/portal?section=calendar&subscribe=1', ['google calendar', 'apple calendar', 'ics', 'feed', 'sync', 'phone']),
  A('meeting-checkin', 'Check in to a meeting', 'Type the code from the screen', '/portal?section=meetings&tab=mine', ['code', 'attend', 'present'], 'attend_meetings'),
  A('meeting-history', 'My meetings and history', 'Coming up and what you attended', '/portal?section=meetings&tab=mine', ['upcoming', 'attended', 'attendance'], 'attend_meetings'),
  A('meeting-plan', 'Plan a meeting', 'Schedule one-off or weekly meetings', '/portal?section=meetings&tab=host', ['schedule', 'create', 'new', 'weekly', 'repeat', 'run', 'show code'], 'host_meetings'),
  A('meeting-groups', 'Meeting groups', 'Saved groups of people', '/portal?section=meetings&tab=groups', ['group', 'people', 'hr team'], 'host_meetings'),
  A('attendance', 'Meeting attendance results', 'Turnout, rates and follow-ups', '/portal?section=meetings&tab=attendance', ['hr', 'export', 'csv', 'absent', 'results'], ['host_meetings', 'view_attendance_reports']),
  A('internal-plan', 'Plan an internal event', 'Social, training or workshop', '/portal?section=internal-events&tab=plan', ['create', 'new', 'schedule', 'social', 'training'], 'host_internal_events'),
  A('event-new', 'Create a public event', 'New event with tickets and flyer', '/portal/events/new', ['new', 'add', 'flyer', 'tickets'], 'manage_events'),
  A('scan', 'Scan tickets', 'Open the check-in scanner', '/portal?section=checkin', ['camera', 'qr', 'redeem'], 'checkin'),
  A('help-inbox', 'Help inbox', 'Answer questions from members', '/portal?section=help&tab=inbox', ['tickets', 'support', 'reply'], 'manage_help'),
  A('access', 'Give someone access', 'Hand one permission to a person or group', '/portal?section=admin&tab=access', ['permission', 'hr', 'grant', 'capability'], 'view_admin_dashboard'),
  A('roles', 'Manage roles', 'Change who holds which role', '/portal?section=admin&tab=roles', ['member', 'promote', 'exec', 'officer', 'recruit'], 'manage_roles'),
  A('audit', 'Audit log', 'Who changed what', '/portal?section=admin&tab=audit', ['history', 'log'], 'view_admin_dashboard'),
  A('links', 'Short links', 'Manage /go links', '/portal?section=admin&tab=links', ['url', 'redirect', 'linktree'], 'view_admin_dashboard'),
];

export function commandsFor(roles: RoleGrant[]): PortalCommand[] {
  return DEFS.filter((d) => {
    const caps = d.cap ? (Array.isArray(d.cap) ? d.cap : [d.cap]) : [];
    if (caps.length && !caps.some((c) => hasCapability(roles, c))) return false;
    if (d.test && !d.test(roles)) return false;
    return true;
  }).map(({ id, label, hint, href, kind, keywords }) => ({ id, label, hint, href, kind, keywords }));
}

// Words typed so far must each start a word in the label or a keyword. Label hits rank above keyword hits.
export function matchCommands(list: PortalCommand[], query: string, limit = 7): PortalCommand[] {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];
  const starts = (text: string, t: string) => text.toLowerCase().split(/[\s/&-]+/).some((w) => w.startsWith(t));
  const scored = list.flatMap((c) => {
    let score = 0;
    for (const t of tokens) {
      if (starts(c.label, t)) score += 3;
      else if (c.keywords.some((k) => starts(k, t))) score += 1;
      else if (c.hint.toLowerCase().includes(t)) score += 0.5;
      else return [];
    }
    return [{ c, score: score + (c.kind === 'Do' ? 0.1 : 0) }];
  });
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((x) => x.c);
}

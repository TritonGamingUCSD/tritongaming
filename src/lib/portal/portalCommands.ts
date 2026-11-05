import { hasCapability, isRewardsEligible, type RoleGrant } from '@/lib/portal/capabilities';
import type { Capability } from '@/types/database';
import { SECTIONS } from '@/lib/portal/sections';
import { CAPABILITY_ROLES } from '@/lib/portal/capabilities';
import { ROLE_DISPLAY_RANK, ROLE_LABELS } from '@/types/database';

// Sections and actions the portal search can jump to. Filtered by what the person can actually open, so the
// search never offers something that would just say "no access".
export interface PortalCommand {
  id: string;
  label: string;
  hint: string;
  href: string;
  kind: 'Go to' | 'Do';
  keywords: string[];
  /** Only on a locked result: the lowest role that opens it (e.g. "Executive"). */
  needs?: string;
}

interface Def extends PortalCommand {
  cap?: Capability | Capability[];
  test?: (roles: RoleGrant[]) => boolean;
}

const S = (id: string, label: string, hint: string, section: string, keywords: string[], cap?: Def['cap'], test?: Def['test']): Def => ({
  id: `go-${id}`,
  label,
  hint,
  href: `/portal/${section}`,
  kind: 'Go to',
  keywords,
  cap,
  test,
});
const A = (id: string, label: string, hint: string, href: string, keywords: string[], cap?: Def['cap'], test?: Def['test']): Def => ({
  id: `do-${id}`,
  label,
  hint,
  href,
  kind: 'Do',
  keywords,
  cap,
  test,
});

// The "Go to" entries come from the sections' own definitions (lib/portal/sections.ts); only a section with a special rule for who sees it is listed here.
const SEE_IF: Record<string, Def['test']> = { points: (r) => isRewardsEligible(r) || hasCapability(r, 'manage_rewards_shop') };
const SECTION_DEFS: Def[] = SECTIONS.filter((s) => s.search).map((s) =>
  S(s.search!.id ?? s.id, s.label, s.search!.hint, s.id, s.search!.keywords, s.search!.caps as Capability[] | undefined, SEE_IF[s.id]),
);

const DEFS: Def[] = [
  { id: 'go-home', label: 'Dashboard', hint: 'Your home screen', href: '/portal', kind: 'Go to', keywords: ['home', 'overview'] },
  ...SECTION_DEFS,

  A('help-new', 'Ask for help', 'Open a help ticket', '/portal/help/ask', ['support', 'question', 'bug', 'problem', 'report', 'ticket']),
  A('profile-edit', 'Edit my profile', 'Name, major, games, picture', '/portal/profile', ['update', 'change', 'name', 'major', 'college']),
  A('game-ids', 'Add my game IDs', 'Steam, Riot ID, Genshin UID…', '/portal/profile/card', ['steam', 'riot', 'genshin', 'discord', 'gamertag', 'username'], 'view_members'),
  A('security', 'Login & security', 'Linked Google accounts, sign out', '/portal/profile/security', ['google', 'password', 'sign out', 'logout', 'account']),
  A('meeting-checkin', 'Check in to a meeting', 'Type the code from the screen', '/portal/meetings/mine', ['code', 'attend', 'present'], 'attend_meetings'),
  A('meeting-history', 'My meetings and history', 'Coming up and what you attended', '/portal/meetings/mine', ['upcoming', 'attended', 'attendance'], 'attend_meetings'),
  A(
    'meeting-plan',
    'Plan a meeting',
    'Schedule one-off or weekly meetings',
    '/portal/meetings/host',
    ['schedule', 'create', 'new', 'weekly', 'repeat', 'run', 'show code'],
    'host_meetings',
  ),
  A('teams', 'Teams', 'Saved teams of people to invite in one go', '/portal/members/team', ['team', 'group', 'groups', 'people', 'hr team'], 'host_meetings'),
  A(
    'attendance',
    'Meeting attendance results',
    'Turnout, rates and follow-ups',
    '/portal/meetings/tools/attendance',
    ['hr', 'export', 'csv', 'absent', 'results'],
    ['host_meetings', 'view_attendance_reports'],
  ),
  A('event-new', 'Create a public event', 'New event with tickets and flyer', '/portal/events/new', ['new', 'add', 'flyer', 'tickets'], 'manage_events'),
  A('scan', 'Enter a ticket code', 'Check a ticket in by its code', '/portal/checkin', ['code', 'ticket', 'redeem'], 'checkin'),
  A('help-inbox', 'Help inbox', 'Answer questions from members', '/portal/help/inbox', ['tickets', 'support', 'reply'], 'manage_help'),
  A('access', 'Give someone access', 'Hand one permission to a person or group', '/portal/admin/access', ['permission', 'hr', 'grant', 'capability'], 'view_admin_dashboard'),
  A('roles', 'Manage roles', 'Change who holds which role', '/portal/admin/members', ['member', 'promote', 'exec', 'officer', 'recruit'], 'manage_roles'),
  A(
    'board-order',
    'Team page order',
    'Put exec in the order they show on the Team page',
    '/portal/members/display-order',
    ['display', 'order', 'board', 'exec', 'sort'],
    'manage_board_order',
  ),
  A('audit', 'Audit log', 'Who changed what', '/portal/admin/audit-log', ['history', 'log'], 'view_admin_dashboard'),
  A(
    'settings',
    'Site settings',
    'The code everyone shows, the portal banner',
    '/portal/admin/settings',
    ['banner', 'bytecode', 'tgcode', 'code style', 'notice'],
    'view_admin_dashboard',
  ),
  A('previews', 'Previews', 'Every screen and animation, the Test Scan', '/portal/admin/preview', ['animation', 'bytecode', 'scan', 'wink', 'test'], 'view_admin_dashboard'),
  A('links', 'Short links', 'Manage /go links', '/portal/admin/short-links', ['url', 'redirect', 'linktree'], 'view_admin_dashboard'),
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
  const starts = (text: string, t: string) =>
    text
      .toLowerCase()
      .split(/[\s/&-]+/)
      .some((w) => w.startsWith(t));
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
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.c);
}

// What the person cannot open yet, so the search can still say it exists and who it is for ("Strikes · needs Executive"). Only entries with a plain capability rule are offered: a special rule (like Rewards) has no single role to name.
export function lockedCommandsFor(roles: RoleGrant[]): PortalCommand[] {
  const open = new Set(commandsFor(roles).map((c) => c.id));
  return DEFS.flatMap((d) => {
    const caps = d.cap ? (Array.isArray(d.cap) ? d.cap : [d.cap]) : [];
    if (open.has(d.id) || caps.length === 0 || d.test) return [];
    const lowest = caps.flatMap((c) => CAPABILITY_ROLES[c]).sort((a, b) => ROLE_DISPLAY_RANK[a] - ROLE_DISPLAY_RANK[b])[0];
    return lowest ? [{ id: d.id, label: d.label, hint: d.hint, href: d.href, kind: d.kind, keywords: d.keywords, needs: ROLE_LABELS[lowest] }] : [];
  });
}

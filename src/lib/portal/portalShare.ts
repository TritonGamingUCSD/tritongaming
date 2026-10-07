import { parsePortalPath } from '@/lib/portal/portalPath';

// What a shared portal link looks like in a chat preview. The portal needs a login, so an outsider (and a link-preview robot)
// only ever reaches the sign-in page; it uses this to name the page the link points at, without showing anything private.
export const PORTAL_PAGE_INFO: Record<string, { name: string; sub: string; accent: string }> = {
  dashboard: { name: 'Dashboard', sub: 'Your tickets, events and to-dos.', accent: '#4a90d9' },
  calendar: { name: 'Calendar', sub: 'Events and meetings in one place.', accent: '#4a90d9' },
  tickets: { name: 'My Tickets', sub: 'Your event tickets and history.', accent: '#4a90d9' },
  points: { name: 'Rewards', sub: 'Points, perks and the leaderboard.', accent: '#4a90d9' },
  profile: { name: 'Profile', sub: 'Your details and settings.', accent: '#4a90d9' },
  events: { name: 'Events', sub: 'Browse and manage events.', accent: '#e8912d' },
  checkin: { name: 'Check-In', sub: 'Scan tickets at the door.', accent: '#e8912d' },
  members: { name: 'TG Members', sub: 'Everyone in the org.', accent: '#8b6cdc' },
  meetings: { name: 'Meetings', sub: 'Check in, plan and review meetings.', accent: '#8b6cdc' },
  'internal-events': { name: 'Internal Events', sub: 'Socials, trainings and workshops for the team.', accent: '#8b6cdc' },
  keys: { name: 'Storage Keys', sub: 'Who holds each storage key.', accent: '#8b6cdc' },
  shifts: { name: 'Shifts', sub: 'Who works which station, and when.', accent: '#8b6cdc' },
  strikes: { name: 'Strikes', sub: 'Attendance and strike tracking.', accent: '#8b6cdc' },
  quarters: { name: 'Quarter Status', sub: 'Who is active each quarter.', accent: '#8b6cdc' },
  divisions: { name: 'Divisions', sub: 'Manage divisions.', accent: '#8b6cdc' },
  'division-members': { name: 'Division Members', sub: 'People in each division.', accent: '#8b6cdc' },
  docs: { name: 'Documentation', sub: 'Guides and how-tos for the team.', accent: '#2fae86' },
  qrcode: { name: 'QR Studio', sub: 'Make QR codes.', accent: '#2fae86' },
  albums: { name: 'Photo Albums', sub: 'Event photos.', accent: '#2fae86' },
  help: { name: 'Help', sub: 'Ask a question or report a problem.', accent: '#2fae86' },
  admin: { name: 'Admin', sub: 'Roles, access and analytics.', accent: '#d9487f' },
  'site-content': { name: 'Site Content', sub: 'Edit the public website.', accent: '#d9487f' },
};

/** The portal page a `?next=` value points at, or null when it isn't a hub page. */
export function portalTargetFromNext(next: string | undefined): { section: string; name: string } | null {
  if (!next || !next.startsWith('/portal')) return null;
  const path = next.split('?')[0];
  let section = parsePortalPath(path)?.section;
  if (!section && /^\/portal\/?$/.test(path) && !new URLSearchParams(next.split('?')[1] ?? '').get('section')) section = 'dashboard';
  if (!section) section = new URLSearchParams(next.split('?')[1] ?? '').get('section') ?? undefined;
  const info = section ? PORTAL_PAGE_INFO[section] : undefined;
  return section && info ? { section, name: info.name } : null;
}

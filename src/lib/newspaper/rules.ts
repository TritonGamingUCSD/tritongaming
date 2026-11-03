// Who an issue goes to, as rules. The picks add up (anyone who matches any of them is in); then the people named in `exclude` are taken out, and anyone who turned this kind of email off (or all club emails) is skipped.
// Client-safe: the editor and the routes share it.

export const AUDIENCE_ROLE_LIST = [
  { id: 'exec', label: 'Exec' },
  { id: 'lead', label: 'Leads' },
  { id: 'officer', label: 'Officers' },
  { id: 'division', label: 'Division accounts' },
  { id: 'recruit', label: 'Recruits' },
  { id: 'alumni', label: 'Alumni' },
  { id: 'ucsd', label: 'UCSD students' },
] as const;
export type AudienceRoleId = (typeof AUDIENCE_ROLE_LIST)[number]['id'];

export interface EventPick {
  id: string;
  who: 'ticket' | 'checkedin';
}
export interface AudienceRules {
  everyone: boolean; // every account
  roles: AudienceRoleId[];
  divisions: string[]; // division ids: people holding a role in the division
  teams: string[]; // saved teams (meeting groups)
  events: EventPick[];
  people: string[];
  exclude: string[];
  subscribers: boolean; // public sign-ups
}
export const NO_AUDIENCE: AudienceRules = { everyone: false, roles: [], divisions: [], teams: [], events: [], people: [], exclude: [], subscribers: false };

const UUID = /^[0-9a-f-]{36}$/i;
const ids = (v: unknown, max: number) => [...new Set((Array.isArray(v) ? v : []).filter((x): x is string => typeof x === 'string' && UUID.test(x)))].slice(0, max);

export function cleanRules(raw: unknown): AudienceRules {
  const r = (raw ?? {}) as Record<string, unknown>;
  const roles = [...new Set((Array.isArray(r.roles) ? r.roles : []).filter((x): x is AudienceRoleId => AUDIENCE_ROLE_LIST.some((a) => a.id === x)))];
  const events = (Array.isArray(r.events) ? r.events : []).flatMap((e) => {
    const x = (e ?? {}) as Record<string, unknown>;
    return typeof x.id === 'string' && UUID.test(x.id) ? [{ id: x.id, who: x.who === 'checkedin' ? ('checkedin' as const) : ('ticket' as const) }] : [];
  });
  return {
    everyone: r.everyone === true,
    roles,
    divisions: ids(r.divisions, 50),
    teams: ids(r.teams, 50),
    events: events.filter((e, i) => events.findIndex((o) => o.id === e.id && o.who === e.who) === i).slice(0, 30),
    people: ids(r.people, 1000),
    exclude: ids(r.exclude, 1000),
    subscribers: r.subscribers === true,
  };
}

/** Has anything been picked at all? An issue with no audience can't be sent. */
export const rulesEmpty = (a: AudienceRules) => !a.everyone && !a.roles.length && !a.divisions.length && !a.teams.length && !a.events.length && !a.people.length && !a.subscribers;

/** The kind of email an issue is, for the opt-out setting and the sender: the newspaper follows Newsletter; event announcements and updates follow "Event updates and announcements". */
export type IssueType = 'newspaper' | 'event_announcement' | 'event_update';
export const ISSUE_TYPES: Record<IssueType, { label: string; hint: string; kind: 'newsletter' | 'updates' }> = {
  newspaper: { label: 'Newspaper', hint: 'News from the club, with any blocks', kind: 'newsletter' },
  event_announcement: { label: 'Event Announcement', hint: 'Tell people about an event', kind: 'updates' },
  event_update: { label: 'Event Update', hint: 'A change of room, time or plan for an event', kind: 'updates' },
};
export const isIssueType = (v: unknown): v is IssueType => typeof v === 'string' && v in ISSUE_TYPES;

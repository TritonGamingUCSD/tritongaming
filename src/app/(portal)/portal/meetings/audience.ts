import { AUDIENCE_ROLES, audienceRoles } from '@/lib/meetings/meetingAudience';

// Who a meeting is for: the UNION of roles (everyone holding them, live), saved groups (their current
// members, live) and individually added people.
export interface Aud {
  roles: string[];
  groups: string[];
  invitees: string[];
  open: boolean;
}

// Nobody is pre-selected: whoever plans it has to choose who it is for.
export const defaultAud = (): Aud => ({ roles: [], groups: [], invitees: [], open: true });

export const audFrom = (m: { audience: string[] | null; invitees: string[] | null; group_ids: string[] | null; open_to_team?: boolean | null }): Aud => ({
  roles: audienceRoles({ audience: m.audience, invitees: m.invitees, group_ids: m.group_ids }),
  groups: m.group_ids ?? [],
  invitees: m.invitees ?? [],
  open: m.open_to_team !== false,
});

export const audPayload = (a: Aud) => ({ audience: a.roles, group_ids: a.groups, invitees: a.invitees, open_to_team: a.open });

// A repeating meeting for every team role and nobody picked by name or group: everyone is expected, so there is nobody else to let in.
export const wholeTeamAud = (m: { audience: string[] | null; invitees: string[] | null; group_ids: string[] | null }) =>
  audienceRoles({ audience: m.audience, invitees: m.invitees, group_ids: m.group_ids }).length === AUDIENCE_ROLES.length && !m.invitees?.length && !m.group_ids?.length;

export const audienceEmpty = (a: Aud) => a.roles.length === 0 && a.groups.length === 0 && a.invitees.length === 0;

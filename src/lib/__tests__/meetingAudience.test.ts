import { describe, expect, it } from 'vitest';
import { audienceRoles, canAttendMeeting, isExpected, isExpectedActive, isInactiveMember, validateAudienceInput } from '@/lib/meetingAudience';

const roles = (...r: string[]) => r.map((role) => ({ role }));

describe('who a meeting is for', () => {
  it('defaults to the whole team when nothing is chosen', () => {
    expect(audienceRoles({ audience: null }).sort()).toEqual(['exec', 'lead', 'officer', 'recruit']);
  });
  it('uses no roles when only people or groups were picked', () => {
    expect(audienceRoles({ audience: null, invitees: ['u1'] })).toEqual([]);
  });
  it('is the union of roles and added people', () => {
    const m = { audience: ['officer'], extra_ids: ['guest1'] };
    expect(isExpected(m, 'x', roles('officer'))).toBe(true);
    expect(isExpected(m, 'guest1', roles('alumni'))).toBe(true);
    expect(isExpected(m, 'x', roles('recruit'))).toBe(false);
  });
});

describe('checking in', () => {
  const officersOnly = { audience: ['officer'] };
  it('exec and admin get no exception: they must be listed too', () => {
    expect(canAttendMeeting(officersOnly, 'e', roles('exec'))).toBe(false);
    expect(canAttendMeeting(officersOnly, 'a', roles('admin'))).toBe(false);
    expect(canAttendMeeting({ audience: ['exec'] }, 'e', roles('exec'))).toBe(true);
  });
  it('someone added by name can check in whatever their role', () => {
    expect(canAttendMeeting({ audience: [], extra_ids: ['e'] }, 'e', roles('exec'))).toBe(true);
  });
});

describe('audience input from the form', () => {
  it('leaving everything empty means the default: the whole team', () => {
    const r = validateAudienceInput({ audience: [], invitees: [], group_ids: [] });
    expect(r.ok && r.audience).toBe(null);
    expect(audienceRoles({ audience: null }).length).toBe(4);
  });
  it('keeps explicit roles, and people added by id', () => {
    const r = validateAudienceInput({ audience: ['officer'], invitees: ['11111111-1111-4111-8111-111111111111'] });
    expect(r.ok && r.audience).toEqual(['officer']);
    expect(r.ok && r.invitees).toEqual(['11111111-1111-4111-8111-111111111111']);
  });
  it('rejects malformed ids', () => {
    expect(validateAudienceInput({ invitees: ['not-an-id'] }).ok).toBe(false);
  });
  it('rejects roles that are not team roles', () => {
    expect(validateAudienceInput({ audience: ['admin'] }).ok).toBe(false);
  });
});

describe('meetings for chosen people only', () => {
  it('are not for the whole team just because no role was ticked', () => {
    // A meeting with audience=null plus individually added people: only those people.
    const m = { audience: null, extra_ids: ['guest1'] };
    expect(isExpected(m, 'guest1', roles('alumni'))).toBe(true);
    expect(isExpected(m, 'someone', roles('exec'))).toBe(false);
    expect(isExpected(m, 'someone', roles('officer'))).toBe(false);
  });
});

describe('inactive officers', () => {
  const roles = (...r: string[]) => r.map((role) => ({ role }));
  const idle = roles('officer', 'inactive');
  it('are not pulled in by a meeting\'s roles', () => {
    expect(isInactiveMember(idle)).toBe(true);
    expect(isExpected({ audience: null }, 'x', idle)).toBe(true);                   // they can still SEE it
    expect(isExpectedActive({ audience: null }, 'x', idle)).toBe(false);            // default everyone
    expect(isExpectedActive({ audience: ['officer'] }, 'x', idle)).toBe(false);     // an all-officers meeting
    expect(canAttendMeeting({ audience: ['officer'] }, 'x', idle)).toBe(false);
    expect(canAttendMeeting({ audience: ['officer'] }, 'a', roles('officer'))).toBe(true);
  });
  it('are expected and can check in when added by name or through a group', () => {
    const m = { audience: null, invitees: ['x'], extra_ids: ['x'] };
    expect(isExpectedActive(m, 'x', idle)).toBe(true);
    expect(canAttendMeeting(m, 'x', idle)).toBe(true);
    expect(isExpectedActive(m, 'y', idle)).toBe(false);                             // someone else who was not added
  });
});

describe('alumni', () => {
  const roles = (...r: string[]) => r.map((role) => ({ role }));
  it('are not pulled in by a role, even with an old team role left on the account', () => {
    expect(isExpected({ audience: null }, 'x', roles('officer', 'alumni'))).toBe(false);
    expect(isExpectedActive({ audience: ['officer'] }, 'x', roles('officer', 'alumni'))).toBe(false);
  });
  it('are expected when added by name', () => {
    expect(isExpectedActive({ audience: null, invitees: ['x'], extra_ids: ['x'] }, 'x', roles('alumni'))).toBe(true);
  });
});

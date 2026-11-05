import { describe, expect, test } from 'vitest';
import type { AppRole } from '@/types/database';
import { canActInAnyDivision, canActInDivision, canDivisionAction, divisionLevel, myDivisions } from '../divisionAccess';
import { hasCapability } from '../capabilities';
import { isOrgMember } from '@/lib/members/profile';
import { isRewardsEligible, isVerifiedMember } from '../capabilities';
import { withRole } from '../roleGrant';

const g = (role: AppRole, division_id: string | null = null) => ({ role, division_id });
const A = 'div-a',
  B = 'div-b';

describe('division access', () => {
  test('a person is in a division at one level', () => {
    expect(divisionLevel([g('division', A)], A)).toBe('head');
    expect(divisionLevel([g('division_member', A)], A)).toBe('member');
    expect(divisionLevel([g('division_alumni', A)], A)).toBe('alumni');
    expect(divisionLevel([g('division', A)], B)).toBeNull();
    expect(divisionLevel([g('officer')], A)).toBeNull();
  });

  test('levels stack: a Head can do what a Member and an Alumnus can, and only in their own division', () => {
    const head = [g('division', A)];
    expect(canActInDivision(head, A, 'head')).toBe(true);
    expect(canActInDivision(head, A, 'member')).toBe(true);
    expect(canActInDivision(head, A, 'alumni')).toBe(true);
    expect(canActInDivision(head, B, 'alumni')).toBe(false);
    const member = [g('division_member', A)];
    expect(canActInDivision(member, A, 'member')).toBe(true);
    expect(canActInDivision(member, A, 'head')).toBe(false);
    const alumni = [g('division_alumni', A)];
    expect(canActInDivision(alumni, A, 'alumni')).toBe(true);
    expect(canActInDivision(alumni, A, 'member')).toBe(false);
  });

  test('exec and admin can do everything in every division; TG officers and leads cannot by that alone', () => {
    for (const r of ['exec', 'admin'] as AppRole[]) {
      expect(canActInDivision([g(r)], A, 'head')).toBe(true);
      expect(canActInAnyDivision([g(r)], 'head')).toBe(true);
    }
    for (const r of ['officer', 'lead', 'recruit', 'alumni', 'ucsd'] as AppRole[]) {
      expect(canActInDivision([g(r)], A, 'alumni')).toBe(false);
      expect(canActInAnyDivision([g(r)], 'alumni')).toBe(false);
    }
  });

  test('roles stand alone: a division role adds nothing in TG, a TG role adds nothing in a division', () => {
    const both = [g('officer'), g('division_alumni', A)];
    expect(canActInDivision(both, A, 'alumni')).toBe(true);
    expect(canActInDivision(both, A, 'member')).toBe(false); // the TG officer role does not make them a member
    expect(hasCapability(both, 'checkin')).toBe(true); // and being alumni of a division does not take TG powers away
    expect(hasCapability([g('division_member', A)], 'checkin')).toBe(false);
    expect(hasCapability([g('division_member', A)], 'manage_events')).toBe(false);
  });

  test('each action needs the right level', () => {
    const member = [g('division_member', A)];
    expect(canDivisionAction(member, A, 'check_in')).toBe(true);
    expect(canDivisionAction(member, A, 'run_live_tools')).toBe(true);
    expect(canDivisionAction(member, A, 'manage_events')).toBe(false);
    expect(canDivisionAction(member, A, 'manage_members')).toBe(false);
    const alumni = [g('division_alumni', A)];
    expect(canDivisionAction(alumni, A, 'see_home')).toBe(true);
    expect(canDivisionAction(alumni, A, 'check_in')).toBe(false);
    const head = [g('division', A)];
    for (const a of ['manage_events', 'edit_page', 'manage_members', 'manage_heads', 'write_docs', 'post_announcements', 'request_logistics', 'see_numbers'] as const) {
      expect(canDivisionAction(head, A, a)).toBe(true);
      expect(canDivisionAction(head, B, a)).toBe(false);
    }
  });

  test('someone can be in several divisions', () => {
    const roles = [g('division', A), g('division_member', B)];
    expect(myDivisions(roles)).toEqual([
      { divisionId: A, level: 'head' },
      { divisionId: B, level: 'member' },
    ]);
  });

  test('division people are verified UCSD members, are not in the TG roster, and earn no Rewards points', () => {
    for (const r of ['division', 'division_member', 'division_alumni'] as AppRole[]) {
      expect(isVerifiedMember([g(r, A)])).toBe(true);
      expect(isOrgMember([{ role: r }])).toBe(false);
      expect(isRewardsEligible([g('ucsd'), g(r, A)])).toBe(false);
    }
    expect(isOrgMember([{ role: 'division_member' }, { role: 'officer' }])).toBe(true); // a TG role still makes them TG
    expect(isRewardsEligible([g('ucsd')])).toBe(true);
  });

  test('giving a division role replaces the one they had in that division and keeps the others', () => {
    const now = [g('ucsd'), g('division_member', A), g('division', B)];
    expect(withRole(now, 'division_member', A)).toBeNull(); // already has it
    const head = withRole(now, 'division', A);
    expect(head).toEqual([g('ucsd'), g('division', B), g('division', A)]);
    const alumni = withRole(now, 'division_alumni', B);
    expect(alumni).toEqual([g('ucsd'), g('division_member', A), g('division_alumni', B)]);
    expect(withRole([g('officer')], 'division_member', A)).toEqual([g('officer'), g('division_member', A)]);
  });
});

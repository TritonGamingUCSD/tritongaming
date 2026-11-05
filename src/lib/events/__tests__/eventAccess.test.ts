import { describe, expect, test } from 'vitest';
import type { AppRole } from '@/types/database';
import { canCheckInEvent, canCreateEventFor, canManageEvent } from '../eventAccess';

const g = (role: AppRole, division_id: string | null = null) => ({ role, division_id });
const A = 'div-a';
const B = 'div-b';
const tg = { division_id: null };
const divA = { division_id: A };

describe('who may do what with an event', () => {
  test('a Triton Gaming event follows the club’s permissions as always', () => {
    expect(canManageEvent([g('lead')], tg)).toBe(true);
    expect(canManageEvent([g('officer')], tg)).toBe(false);
    expect(canCheckInEvent([g('officer')], tg)).toBe(true);
    expect(canCheckInEvent([g('recruit')], tg)).toBe(true);
    expect(canManageEvent([g('division', A)], tg)).toBe(false);
    expect(canCheckInEvent([g('division_member', A)], tg)).toBe(false);
  });

  test('a division’s event: Heads manage, Members and Heads check in', () => {
    expect(canManageEvent([g('division', A)], divA)).toBe(true);
    expect(canManageEvent([g('division_member', A)], divA)).toBe(false);
    expect(canManageEvent([g('division_alumni', A)], divA)).toBe(false);
    expect(canCheckInEvent([g('division_member', A)], divA)).toBe(true);
    expect(canCheckInEvent([g('division', A)], divA)).toBe(true);
    expect(canCheckInEvent([g('division_alumni', A)], divA)).toBe(false);
  });

  test('a TG lead or officer cannot touch a division’s event; exec and admin can', () => {
    for (const r of ['lead', 'officer', 'recruit'] as AppRole[]) {
      expect(canManageEvent([g(r)], divA)).toBe(false);
      expect(canCheckInEvent([g(r)], divA)).toBe(false);
    }
    for (const r of ['exec', 'admin'] as AppRole[]) {
      expect(canManageEvent([g(r)], divA)).toBe(true);
      expect(canCheckInEvent([g(r)], divA)).toBe(true);
    }
  });

  test('another division’s Head has no say', () => {
    expect(canManageEvent([g('division', B)], divA)).toBe(false);
    expect(canCheckInEvent([g('division', B)], divA)).toBe(false);
  });

  test('creating an event for an owner', () => {
    expect(canCreateEventFor([g('division', A)], A)).toBe(true);
    expect(canCreateEventFor([g('division', A)], B)).toBe(false);
    expect(canCreateEventFor([g('division', A)], null)).toBe(false);
    expect(canCreateEventFor([g('lead')], null)).toBe(true);
    expect(canCreateEventFor([g('lead')], A)).toBe(false);
  });
});

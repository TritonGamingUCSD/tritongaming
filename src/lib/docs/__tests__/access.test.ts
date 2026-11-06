import { describe, expect, it } from 'vitest';
import { audienceOf, canAccess, canRead, cleanEntries, clubDefaults, describeEntries, divisionDefaults, opensWide, type AccessContext } from '../access';

const D1 = '11111111-1111-4111-8111-111111111111';
const D2 = '22222222-2222-4222-8222-222222222222';
const T1 = '33333333-3333-4333-8333-333333333333';
const U1 = '44444444-4444-4444-8444-444444444444';
const ctx = (over: { userId?: string | null; roles?: { role: string; division_id?: string | null }[]; teamIds?: string[] }): AccessContext => ({
  userId: 'userId' in over ? (over.userId as string | null) : U1,
  roles: (over.roles ?? []).map((r) => ({ role: r.role as never, division_id: r.division_id ?? null })),
  teamIds: over.teamIds ?? [],
});

describe('doc access entries', () => {
  it('everyone lets even a signed-out visitor in; signed in needs an account', () => {
    expect(canAccess([{ t: 'everyone' }], ctx({ userId: null }))).toBe(true);
    expect(canAccess([{ t: 'signed_in' }], ctx({ userId: null }))).toBe(false);
    expect(canAccess([{ t: 'signed_in' }], ctx({}))).toBe(true);
  });
  it('matches a role, a team and a person', () => {
    expect(canAccess([{ t: 'role', role: 'officer' }], ctx({ roles: [{ role: 'officer' }] }))).toBe(true);
    expect(canAccess([{ t: 'role', role: 'officer' }], ctx({ roles: [{ role: 'recruit' }] }))).toBe(false);
    expect(canAccess([{ t: 'team', id: T1 }], ctx({ teamIds: [T1] }))).toBe(true);
    expect(canAccess([{ t: 'person', id: U1 }], ctx({}))).toBe(true);
    expect(canAccess([{ t: 'person', id: T1 }], ctx({}))).toBe(false);
  });
  it('a division entry is for one division or any', () => {
    const heads1 = [{ t: 'division' as const, role: 'division' as const, division_id: D1 }];
    expect(canAccess(heads1, ctx({ roles: [{ role: 'division', division_id: D1 }] }))).toBe(true);
    expect(canAccess(heads1, ctx({ roles: [{ role: 'division', division_id: D2 }] }))).toBe(false);
    expect(canAccess(heads1, ctx({ roles: [{ role: 'division_member', division_id: D1 }] }))).toBe(false);
    const anyHead = [{ t: 'division' as const, role: 'division' as const, division_id: null }];
    expect(canAccess(anyHead, ctx({ roles: [{ role: 'division', division_id: D2 }] }))).toBe(true);
  });
  it('exec and admin always have access; editors can always read', () => {
    expect(canAccess([], ctx({ roles: [{ role: 'exec' }] }))).toBe(true);
    expect(canAccess([], ctx({ roles: [{ role: 'admin' }] }))).toBe(true);
    expect(canRead([], [{ t: 'person', id: U1 }], ctx({}))).toBe(true);
    expect(canRead([], [], ctx({}))).toBe(false);
  });
  it('a division doc starts readable by Heads and Members and editable by Heads', () => {
    const d = divisionDefaults(D1);
    expect(canAccess(d.read, ctx({ roles: [{ role: 'division_member', division_id: D1 }] }))).toBe(true);
    expect(canAccess(d.edit, ctx({ roles: [{ role: 'division_member', division_id: D1 }] }))).toBe(false);
    expect(canAccess(d.edit, ctx({ roles: [{ role: 'division', division_id: D1 }] }))).toBe(true);
  });
  it('a club doc starts like the documentation does today', () => {
    const c = clubDefaults();
    expect(canAccess(c.read, ctx({ roles: [{ role: 'officer' }] }))).toBe(true);
    expect(canAccess(c.edit, ctx({ roles: [{ role: 'officer' }] }))).toBe(false);
    expect(canAccess(c.edit, ctx({ roles: [{ role: 'lead' }] }))).toBe(true);
  });
});

describe('cleaning and describing', () => {
  it('keeps well-formed entries only, once each', () => {
    const e = cleanEntries([
      { t: 'everyone' },
      { t: 'everyone' },
      { t: 'role', role: 'officer' },
      { t: 'role', role: 'division' },
      { t: 'team', id: 'nope' },
      { t: 'division', role: 'division', division_id: D1 },
      { t: 'x' },
      5,
    ]);
    expect(e).toEqual([{ t: 'everyone' }, { t: 'role', role: 'officer' }, { t: 'division', role: 'division', division_id: D1 }]);
  });
  it('knows which lists open a doc wide, and the coarse audience', () => {
    expect(opensWide([{ t: 'signed_in' }])).toBe(true);
    expect(opensWide([{ t: 'role', role: 'officer' }])).toBe(false);
    expect(audienceOf([{ t: 'everyone' }], D1)).toBe('public');
    expect(audienceOf(divisionDefaults(D1).read, D1)).toBe('members');
    expect(audienceOf([{ t: 'division', role: 'division', division_id: D1 }], D1)).toBe('heads');
  });
  it('describes a list in words', () => {
    const s = describeEntries(
      [
        { t: 'division', role: 'division', division_id: D1 },
        { t: 'team', id: T1 },
      ],
      { team: () => 'Tech' },
      D1,
    );
    expect(s).toBe('Heads of this division, Tech team');
  });
});

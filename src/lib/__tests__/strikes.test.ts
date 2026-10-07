import { beforeEach, describe, expect, it, vi } from 'vitest';

const sent: { user_id: string; title: string; body?: string | null }[] = [];
vi.mock('@/lib/notifications/notify', () => ({ createNotifications: async (_svc: unknown, rows: typeof sent) => { sent.push(...rows); return rows.length; } }));

const { STRIKE_LIMIT, crossesLimit, isTracked, notifyLimit, notifyPerson, strikeManagers } = await import('@/lib/members/strikes');

const fakeSvc = (opts: { roles?: string[]; grants?: { user_id: string | null; group_id: string | null }[]; groups?: string[][] }) => ({
  from: (t: string) => ({
    select: () => ({
      in: async () => ({ data: t === 'user_roles' ? (opts.roles ?? []).map((u) => ({ user_id: u })) : (opts.groups ?? []).map((m) => ({ member_ids: m })) }),
      eq: async () => ({ data: t === 'user_roles' ? (opts.roles ?? []).map((u) => ({ user_id: u })) : (opts.grants ?? []) }),
    }),
  }),
}) as never;

beforeEach(() => { sent.length = 0; });

describe('strike rules', () => {
  it('the limit is a warning plus 3 strikes, reached only by the strike that gets someone there', () => {
    expect(STRIKE_LIMIT).toBe(4);   // a warning, then 3 strikes
    expect(crossesLimit(2, 3)).toBe(false);
    expect(crossesLimit(3, 4)).toBe(true);
    expect(crossesLimit(4, 5)).toBe(false);   // already at the limit: no second alert
  });
  it('is tracked for officers, leads and exec only', () => {
    for (const r of ['officer', 'lead', 'exec']) expect(isTracked([{ role: r }])).toBe(true);
    for (const r of ['recruit', 'alumni', 'admin', 'ucsd', 'division']) expect(isTracked([{ role: r }])).toBe(false);
    expect(isTracked([{ role: 'recruit' }, { role: 'officer' }])).toBe(true);
  });
  it('managers are admins, exec, and anyone given the permission directly or through a group', async () => {
    // the fake returns whatever user_roles it was given for the admin/exec lookup
    const m = await strikeManagers(fakeSvc({ roles: ['admin1'], grants: [{ user_id: 'hr1', group_id: null }, { user_id: null, group_id: 'g1' }], groups: [['hr2', 'hr3']] }));
    expect(m.sort()).toEqual(['admin1', 'hr1', 'hr2', 'hr3']);
  });
});

describe('what a notice says', () => {
  it('the test header silences alerts to HR and admins (and is ignored in production)', async () => {
    await notifyLimit(fakeSvc({ roles: ['admin1'], grants: [] }), 'person', 'Ann Lee', true);
    expect(sent.map((n) => n.user_id)).toEqual(['person']);
    const { quietTest } = await import('@/lib/members/strikes');
    const req = new Request('http://x', { headers: { 'x-strikes-test': '1' } });
    const old = process.env.NODE_ENV;
    (process.env as Record<string, string>).NODE_ENV = 'development'; expect(quietTest(req)).toBe(true);
    (process.env as Record<string, string>).NODE_ENV = 'production'; expect(quietTest(req)).toBe(false);
    (process.env as Record<string, string>).NODE_ENV = old!;
  });
  it('reaching the limit tells the person HR will contact them, and tells HR and admins (never the person twice)', async () => {
    await notifyLimit(fakeSvc({ roles: ['admin1', 'person'], grants: [] }), 'person', 'Ann Lee');
    expect(sent.filter((n) => n.user_id === 'person')).toHaveLength(1);
    expect(sent.find((n) => n.user_id === 'person')!.body).toMatch(/HR team will be contacting you/);
    expect(sent.find((n) => n.user_id === 'admin1')!.title).toBe('Ann Lee reached 3 strikes');
  });
  it('a routine notice never says what the strike was for (it can show on a lock screen)', async () => {
    await notifyPerson(fakeSvc({}), 'p', 'Your strikes were updated', 'Open your dashboard to see it.');
    expect(sent).toHaveLength(1);
    expect(JSON.stringify(sent[0])).not.toMatch(/missed|absent|reason|meeting/i);
  });
});

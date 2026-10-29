import { describe, it, expect } from 'vitest';
import { parseEmails, applyPendingGrants, cleanupExpiredGrants } from '@/lib/members/roleByEmail';

describe('parseEmails', () => {
  it('finds addresses in a messy paste, lowercase and without duplicates', () => {
    const text = 'Alex Kim <Alex@UCSD.edu>, jamie@ucsd.edu;\nsam.o+club@gmail.com  alex@ucsd.edu. thanks! not-an-email';
    expect(parseEmails(text)).toEqual(['alex@ucsd.edu', 'jamie@ucsd.edu', 'sam.o+club@gmail.com']);
  });
  it('returns nothing for text with no address', () => {
    expect(parseEmails('hello world')).toEqual([]);
  });
});

// A tiny stand-in for the database client: tables as arrays, just the calls applyPendingGrants makes.
function fakeSvc(pending: Record<string, unknown>[], roles: Record<string, unknown>[]) {
  const calls: { rpc: unknown[]; deleted: string[] } = { rpc: [], deleted: [] };
  const svc = {
    from(table: string) {
      return {
        select: () => ({
          in: () => ({ gt: async () => ({ data: pending }) }),
          eq: async () => ({ data: roles }),
        }),
        delete: () => ({
          eq: async (_c: string, id: string) => {
            calls.deleted.push(id);
            return {};
          },
        }),
      } as never;
      void table;
    },
    rpc: async (_name: string, args: unknown) => {
      calls.rpc.push(args);
      return { error: null };
    },
  };
  return { svc: svc as never, calls };
}

describe('applyPendingGrants', () => {
  it('gives a waiting role and clears it', async () => {
    const { svc, calls } = fakeSvc([{ id: 'p1', role: 'recruit', division_id: null, created_by: 'admin1' }], [{ role: 'ucsd', division_id: null }]);
    expect(await applyPendingGrants(svc, 'u1', ['Alex@UCSD.edu'])).toBe(1);
    expect((calls.rpc[0] as { _roles: { role: string }[]; _granted_by: string })._roles.map((r) => r.role).sort()).toEqual(['recruit', 'ucsd']);
    expect((calls.rpc[0] as { _granted_by: string })._granted_by).toBe('admin1');
    expect(calls.deleted).toEqual(['p1']);
  });
  it('clears a waiting role the person already has, without changing anything', async () => {
    const { svc, calls } = fakeSvc([{ id: 'p2', role: 'recruit', division_id: null, created_by: null }], [{ role: 'recruit', division_id: null }]);
    expect(await applyPendingGrants(svc, 'u1', ['a@b.co'])).toBe(0);
    expect(calls.rpc).toEqual([]);
    expect(calls.deleted).toEqual(['p2']);
  });
  it('does nothing without an email', async () => {
    const { svc, calls } = fakeSvc([], []);
    expect(await applyPendingGrants(svc, 'u1', ['', '  '])).toBe(0);
    expect(calls.rpc).toEqual([]);
  });
});

describe('cleanupExpiredGrants', () => {
  it('deletes waiting grants whose 90 days are over', async () => {
    const seen: unknown[] = [];
    const svc = {
      from: (t: string) => ({
        delete: () => ({
          lt: async (c: string, v: string) => {
            seen.push([t, c, v]);
            return { count: 3 };
          },
        }),
      }),
    } as never;
    expect(await cleanupExpiredGrants(svc, new Date('2026-10-17T00:00:00Z'))).toEqual({ removed: 3 });
    expect(seen).toEqual([['pending_role_grants', 'expires_at', '2026-10-17T00:00:00.000Z']]);
  });
});

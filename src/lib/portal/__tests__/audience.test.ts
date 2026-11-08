import { describe, expect, it } from 'vitest';
import { homeFor, usesPortal } from '../audience';

const r = (...roles: string[]) => roles.map((role) => ({ role, division_id: null })) as never;

describe('who uses the portal', () => {
  it('a guest (no role) and a student live on /me', () => {
    expect(usesPortal(r())).toBe(false);
    expect(usesPortal(r('ucsd'))).toBe(false);
    expect(homeFor(r())).toBe('/me');
    expect(homeFor(r('ucsd'))).toBe('/me');
  });
  it('anyone with another role uses the portal', () => {
    for (const role of ['recruit', 'alumni', 'officer', 'lead', 'exec', 'admin', 'division', 'division_member']) expect(homeFor(r('ucsd', role))).toBe('/portal');
  });
  it('permissions handed to a person are not roles', () => {
    expect(usesPortal(r('ucsd', 'cap:view_events', 'deny:view_events'))).toBe(false);
  });
});

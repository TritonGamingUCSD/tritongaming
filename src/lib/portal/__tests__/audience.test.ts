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

import { meAddressFor } from '../audience';

describe('where a student or guest goes instead of the portal', () => {
  it('maps the pages they use to /me', () => {
    expect(meAddressFor(undefined)).toBe('/me/events');
    expect(meAddressFor('all')).toBe('/me/events');
    expect(meAddressFor('tickets')).toBe('/me/tickets');
    expect(meAddressFor('tickets', 'history')).toBe('/me/tickets');
    expect(meAddressFor('activity')).toBe('/me/tickets');
    expect(meAddressFor('calendar', 'week', '2026-11-10')).toBe('/me/calendar?view=week&date=2026-11-10');
    expect(meAddressFor('points', 'shop')).toBe('/me/rewards?tab=shop');
    expect(meAddressFor('profile', 'linked')).toBe('/me/profile?tab=linked');
    expect(meAddressFor('help')).toBe('/me/help');
  });
  it('leaves every other section alone', () => {
    for (const s of ['events', 'checkin', 'meetings', 'admin', 'division', 'docs']) expect(meAddressFor(s)).toBeNull();
  });
});

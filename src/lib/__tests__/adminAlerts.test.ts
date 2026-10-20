import { describe, expect, it } from 'vitest';
import { USAGE_LIMITS, isRiskyAudit, usageLevel } from '@/lib/notifications/adminAlerts';
import { categoryOf } from '@/lib/notifications/webPush';

describe('admin alerts', () => {
  it('warns at 80% and 90% of a limit, not before', () => {
    const L = USAGE_LIMITS.database;
    expect(usageLevel(L * 0.79, L)).toBe(0);
    expect(usageLevel(L * 0.8, L)).toBe(80);
    expect(usageLevel(L * 0.89, L)).toBe(80);
    expect(usageLevel(L * 0.9, L)).toBe(90);
    expect(usageLevel(L * 2, L)).toBe(90);
  });
  it('matches the database rule for which audit entries are risky', () => {
    expect(isRiskyAudit({ action: 'delete', entityType: 'quarter' })).toBe(true);
    expect(isRiskyAudit({ action: 'merge', entityType: 'member' })).toBe(true);
    expect(isRiskyAudit({ action: 'update', entityType: 'account' })).toBe(true);
    expect(isRiskyAudit({ action: 'update', entityType: 'tier' })).toBe(true);
    expect(isRiskyAudit({ action: 'adjust', entityType: 'points' })).toBe(true);
    expect(isRiskyAudit({ action: 'award', entityType: 'points' })).toBe(false);
    expect(isRiskyAudit({ action: 'update', entityType: 'roles' })).toBe(false);
  });
  it('puts admin alerts under one mutable kind', () => {
    for (const t of ['audit_alert', 'system_usage', 'system_failure']) expect(categoryOf(t)).toBe('admin');
  });
});

import { describeRoleChange, pointsText } from '@/lib/notifications/memberNotices';
describe('member notices', () => {
  it('describes a role change and ignores one nobody would notice', () => {
    expect(describeRoleChange(['ucsd'], ['ucsd'])).toBeNull();
    expect(describeRoleChange(['ucsd'], ['ucsd', 'exec'])).toMatchObject({ title: 'You were given a new role' });
    expect(describeRoleChange(['ucsd', 'exec'], ['ucsd'])).toMatchObject({ title: 'A role was removed from you' });
    expect(describeRoleChange(['exec'], ['admin'])?.title).toBe('Your roles changed');
  });
  it('writes points plainly', () => {
    expect(pointsText(50)).toBe('+50 points');
    expect(pointsText(1)).toBe('+1 point');
    expect(pointsText(-20)).toBe('−20 points');
  });
  it('puts points and rewards under their own mutable kind', () => {
    for (const t of ['points_added', 'points_removed', 'points_reversed', 'reward_handed_over', 'reward_cancelled']) expect(categoryOf(t)).toBe('points');
    expect(categoryOf('role_changed')).toBe('account');
  });
});

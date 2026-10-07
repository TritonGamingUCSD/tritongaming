import { describe, expect, it } from 'vitest';
import { coverAlertDue, parseChecklist } from '@/lib/shifts/shiftFields';
import { withRole } from '@/lib/portal/roleGrant';
import { parseRoleRequest, roleRequestBody } from '@/lib/notifications/helpConstants';

const H = 3600_000;
const at = (ms: number) => new Date(1_700_000_000_000 + ms);

describe('parseChecklist', () => {
  it('keeps one item per line, trimmed, without blanks or repeats', () => {
    expect(parseChecklist('  Set out signs \n\nTest scanner\nSet out signs\n')).toEqual(['Set out signs', 'Test scanner']);
  });
  it('caps the list at 30 items and each item at 120 characters', () => {
    expect(parseChecklist(Array.from({ length: 40 }, (_, i) => `item ${i}`).join('\n'))).toHaveLength(30);
    expect(parseChecklist('x'.repeat(200))[0]).toHaveLength(120);
  });
});

describe('coverAlertDue', () => {
  const base = { createdAt: at(0), alerted: false, alertedFinal: false };
  it('waits 3 hours before the first alert', () => {
    expect(coverAlertDue({ ...base, now: at(2 * H), start: at(10 * H) })).toBeNull();
    expect(coverAlertDue({ ...base, now: at(3 * H), start: at(10 * H) })).toBe('late');
  });
  it('alerts again within 2 hours of the shift, once', () => {
    expect(coverAlertDue({ ...base, alerted: true, now: at(8.5 * H), start: at(10 * H) })).toBe('final');
    expect(coverAlertDue({ ...base, alerted: true, alertedFinal: true, now: at(9.5 * H), start: at(10 * H) })).toBeNull();
  });
  it('never alerts once the shift has started', () => {
    expect(coverAlertDue({ ...base, now: at(11 * H), start: at(10 * H) })).toBeNull();
  });
});

describe('withRole', () => {
  it('adds a plain role and keeps the others', () => {
    expect(withRole([{ role: 'ucsd', division_id: null }], 'officer', null)).toEqual([{ role: 'ucsd', division_id: null }, { role: 'officer', division_id: null }]);
  });
  it('does nothing when they already have it', () => {
    expect(withRole([{ role: 'officer', division_id: null }], 'officer', null)).toBeNull();
    expect(withRole([{ role: 'division', division_id: 'a' }], 'division', 'a')).toBeNull();
  });
  it('adds a division next to the ones they already lead', () => {
    expect(withRole([{ role: 'division', division_id: 'a' }], 'division', 'b')).toEqual([{ role: 'division', division_id: 'a' }, { role: 'division', division_id: 'b' }]);
  });
});

describe('role request text', () => {
  it('reads back what the form wrote', () => {
    const m = roleRequestBody({ role: 'division', division: 'Esports', vouch: 'Sam (exec)' });
    expect(m.subject).toBe('Role request: Division lead');
    expect(parseRoleRequest(m.subject, m.body)).toEqual({ role: 'division', division: 'Esports' });
  });
  it('understands older free-text requests by their subject', () => {
    expect(parseRoleRequest('Role request: Officer', 'please')).toEqual({ role: 'officer', division: null });
    expect(parseRoleRequest('Role or access request', '')).toEqual({ role: null, division: null });
  });
});

import { describe, expect, it } from 'vitest';
import { cleanDevice, cleanKit, cleanList, describeChange, quantityText, tagKey, type Device } from '@/lib/logistics/devices';
import { DEFAULT_KIT, OWNER_TYPES, CONDITIONS } from '@/lib/logistics/constants';
import { hasCapability, withGrantedCapabilities } from '@/lib/portal/capabilities';
import type { AppRole } from '@/types/database';

const base: Device = {
  id: 'd1', tag: 'TECM1', name: null, type: 'Gaming PC', shelf: 'Shelf A', tier: 'T1', place_note: null, condition: 'working', owner_type: 'club', owner_user_id: null, sponsor_id: null, owner_note: null,
  ports: [], login: null, games: [], kit: [{ item: 'Power cable', qty: 1, missing: false }], quantity: null, quantity_is_estimate: true, notes: null, created_at: '', updated_at: '',
};

describe('device IDs', () => {
  it('matches TECM1, tecm1 and "TECM 1" as the same device', () => {
    expect(tagKey('TECM1')).toBe('tecm1');
    expect(tagKey(' tecm 1 ')).toBe('tecm1');
    expect(tagKey('PA 1')).toBe(tagKey('pa1'));
    expect(tagKey(null)).toBe('');
  });
});

describe('reading a device from the browser', () => {
  it('keeps only what was sent, trimmed and limited', () => {
    expect(cleanDevice({ tag: '  TECM2 ', name: '' }).value).toEqual({ tag: 'TECM2', name: null });
    expect(cleanDevice({ shelf: 'Shelf C', unknown: 'x' }).value).toEqual({ shelf: 'Shelf C' });
    expect(cleanDevice({ tag: 'x'.repeat(100) }).value.tag).toHaveLength(40);
  });
  it('rejects a bad condition, owner type, empty type and bad quantity with a plain sentence', () => {
    expect(cleanDevice({ condition: 'broken' }).error).toMatch(/condition/i);
    expect(cleanDevice({ owner_type: 'nobody' }).error).toMatch(/owns/i);
    expect(cleanDevice({ type: '  ' }).error).toMatch(/kind of device/i);
    expect(cleanDevice({ quantity: -3 }).error).toMatch(/whole number/i);
    expect(cleanDevice({ quantity: 'abc' }).error).toMatch(/whole number/i);
    for (const c of CONDITIONS) expect(cleanDevice({ condition: c.id }).error).toBeUndefined();
    for (const o of OWNER_TYPES) expect(cleanDevice({ owner_type: o.id }).error).toBeUndefined();
  });
  it('makes the owner fields agree with the owner type', () => {
    const id = '11111111-1111-1111-1111-111111111111';
    expect(cleanDevice({ owner_type: 'club', owner_user_id: id, sponsor_id: id }).value).toMatchObject({ owner_user_id: null, sponsor_id: null });
    expect(cleanDevice({ owner_type: 'sponsor', owner_user_id: id, sponsor_id: id }).value).toMatchObject({ owner_user_id: null, sponsor_id: id });
    expect(cleanDevice({ owner_type: 'officer', owner_user_id: id, sponsor_id: id }).value).toMatchObject({ owner_user_id: id, sponsor_id: null });
    expect(cleanDevice({ owner_user_id: 'not-an-id' }).value.owner_user_id).toBeNull();
  });
  it('cleans lists and kits: no blanks, no repeats, sane quantities', () => {
    expect(cleanList([' HDMI ', 'hdmi', '', 'USB-C'])).toEqual(['HDMI', 'USB-C']);
    expect(cleanList('nope')).toEqual([]);
    expect(cleanKit([{ item: 'Charger', qty: 0, missing: true }, { item: 'charger' }, { item: 'Mouse', qty: 2.4 }, { item: '' }])).toEqual([{ item: 'Charger', qty: 1, missing: true }, { item: 'Mouse', qty: 2, missing: false }]);
  });
  it('lets a counted quantity be an estimate or not', () => {
    expect(cleanDevice({ quantity: 30, quantity_is_estimate: true }).value).toEqual({ quantity: 30, quantity_is_estimate: true });
    expect(cleanDevice({ quantity_is_estimate: false }).value.quantity_is_estimate).toBe(false);
    expect(cleanDevice({ quantity: null }).value.quantity).toBeNull();
    expect(quantityText({ quantity: 30, quantity_is_estimate: true })).toBe('about 30');
    expect(quantityText({ quantity: 30, quantity_is_estimate: false })).toBe('30');
    expect(quantityText({ quantity: null, quantity_is_estimate: true })).toBe('Unknown');
  });
});

describe('the history lines for a change', () => {
  it('says what changed in words', () => {
    const lines = describeChange(base, { ...base, condition: 'dead', shelf: 'Shelf C', tier: 'T0', kit: [{ item: 'Power cable', qty: 1, missing: true }, { item: 'HDMI cable', qty: 1, missing: false }] }).map((l) => l.summary);
    expect(lines).toContain('Condition: Working → Dead');
    expect(lines).toContain('Moved: Shelf A · T1 → Shelf C · T0');
    expect(lines).toContain('Marked missing: Power cable');
    expect(lines).toContain('Kit: added HDMI cable');
  });
  it('writes nothing when nothing meaningful changed, and notices a found part and a changed note', () => {
    expect(describeChange(base, { ...base, updated_at: 'later' })).toEqual([]);
    const missing = { ...base, kit: [{ item: 'Power cable', qty: 1, missing: true }] };
    expect(describeChange(missing, base).map((l) => l.summary)).toContain('Found again: Power cable');
    expect(describeChange(base, { ...base, notes: 'Fan is loud' }).map((l) => l.summary)).toEqual(['Notes updated']);
  });
});

describe('what a type usually comes with', () => {
  it('has a starting kit for the common types', () => {
    expect(DEFAULT_KIT['Gaming PC']).toContain('Power cable');
    expect(DEFAULT_KIT['Nintendo Switch']).toEqual(expect.arrayContaining(['Dock', 'Left Joycon', 'Right Joycon']));
  });
});

describe('who can use Logistics', () => {
  const can = (role: AppRole, cap: 'view_logistics' | 'manage_logistics') => hasCapability([{ role, division_id: null }], cap);
  it('lets every officer and above look, but only exec and admin change by default', () => {
    for (const r of ['officer', 'division', 'lead', 'exec', 'admin'] as AppRole[]) expect(can(r, 'view_logistics')).toBe(true);
    for (const r of ['ucsd', 'recruit', 'alumni'] as AppRole[]) expect(can(r, 'view_logistics')).toBe(false);
    for (const r of ['exec', 'admin'] as AppRole[]) expect(can(r, 'manage_logistics')).toBe(true);
    for (const r of ['officer', 'division', 'lead', 'recruit', 'alumni', 'ucsd'] as AppRole[]) expect(can(r, 'manage_logistics')).toBe(false);
  });
  it('can be handed to an officer directly', () => {
    const roles = withGrantedCapabilities([{ role: 'officer', division_id: null }], ['manage_logistics']);
    expect(hasCapability(roles, 'manage_logistics')).toBe(true);
  });
  it('is taken away from an inactive officer who was granted it', () => {
    const roles = withGrantedCapabilities([{ role: 'officer', division_id: null }, { role: 'inactive', division_id: null }], ['manage_logistics']);
    expect(hasCapability(roles, 'manage_logistics')).toBe(false);
    expect(hasCapability(roles, 'view_logistics')).toBe(true);
  });
});

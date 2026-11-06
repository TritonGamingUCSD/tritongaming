import { describe, expect, it } from 'vitest';
import { CAPABILITY_ROLES, GRANTABLE_CAPABILITIES, hasCapability, withGrantedCapabilities } from '../capabilities';
import { CAPABILITY_INFO, RULE_CAPABILITIES } from '../capabilityInfo';
import type { RoleGrant } from '../capabilities';

const r = (role: string): RoleGrant => ({ role: role as RoleGrant['role'], division_id: null });

describe('the permission catalog', () => {
  it('describes every permission the roles table knows', () => {
    expect(Object.keys(CAPABILITY_INFO).sort()).toEqual(Object.keys(CAPABILITY_ROLES).sort());
  });
  it('only lets rules touch app-enforced permissions', () => {
    for (const c of RULE_CAPABILITIES) expect(CAPABILITY_INFO[c].enforced).toBe('app');
    for (const g of GRANTABLE_CAPABILITIES) expect(CAPABILITY_INFO[g.id].enforced).toBe('app');
  });
});

describe('access rules', () => {
  it('a rule can give a permission the role does not have', () => {
    expect(hasCapability([r('officer')], 'manage_tournaments')).toBe(false);
    expect(hasCapability(withGrantedCapabilities([r('officer')], ['manage_tournaments']), 'manage_tournaments')).toBe(true);
  });
  it('a rule can take away a permission the role has', () => {
    expect(hasCapability([r('lead')], 'host_trivia')).toBe(true);
    expect(hasCapability(withGrantedCapabilities([r('lead')], ['deny:host_trivia']), 'host_trivia')).toBe(false);
  });
  it('a denial wins over a grant', () => {
    expect(hasCapability(withGrantedCapabilities([r('officer')], ['manage_broadcast', 'deny:manage_broadcast']), 'manage_broadcast')).toBe(false);
  });
  it('never takes anything from an admin', () => {
    expect(hasCapability(withGrantedCapabilities([r('admin')], ['deny:manage_broadcast']), 'manage_broadcast')).toBe(true);
  });
});

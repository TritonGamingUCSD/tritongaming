import { describe, expect, it } from 'vitest';
import { GRANTABLE_CAPABILITIES, hasCapability, withGrantedCapabilities, type RoleGrant } from '@/lib/capabilities';
import type { AppRole, Capability } from '@/types/database';

const as = (...roles: AppRole[]): RoleGrant[] => roles.map((role) => ({ role, division_id: null }));
const can = (role: AppRole | null, cap: Capability) => hasCapability(role ? as(role) : [], cap);

describe('who can do what', () => {
  it('admin can do everything', () => {
    for (const cap of ['manage_roles', 'view_admin_dashboard', 'view_attendance_reports', 'host_internal_events', 'manage_help'] as Capability[]) {
      expect(can('admin', cap)).toBe(true);
    }
  });

  it('meetings: everyone on the team attends, leads host, only exec/admin run everything', () => {
    for (const r of ['officer', 'lead', 'exec', 'recruit'] as AppRole[]) expect(can(r, 'attend_meetings')).toBe(true);
    for (const r of ['alumni', 'division'] as AppRole[]) expect(can(r, 'attend_meetings')).toBe(false);
    expect(can('lead', 'host_meetings')).toBe(true);
    expect(can('officer', 'host_meetings')).toBe(false);
    expect(can('lead', 'manage_meetings')).toBe(false);
    expect(can('exec', 'manage_meetings')).toBe(true);
  });

  it('internal events: the team sees them, alumni and division leads do not, only leads/exec/admin plan', () => {
    for (const r of ['officer', 'lead', 'exec', 'recruit'] as AppRole[]) expect(can(r, 'view_internal_events')).toBe(true);
    for (const r of ['alumni', 'division'] as AppRole[]) expect(can(r, 'view_internal_events')).toBe(false);
    expect(can('recruit', 'host_internal_events')).toBe(false);
    expect(can('officer', 'host_internal_events')).toBe(false);
    for (const r of ['lead', 'exec'] as AppRole[]) expect(can(r, 'host_internal_events')).toBe(true);
  });

  it('attendance reports and the help inbox are exec/admin only by role', () => {
    for (const cap of ['view_attendance_reports', 'manage_help'] as Capability[]) {
      expect(can('exec', cap)).toBe(true);
      for (const r of ['lead', 'officer', 'recruit', 'alumni', 'division'] as AppRole[]) expect(can(r, cap)).toBe(false);
      expect(can(null, cap)).toBe(false);
    }
  });

  it('admin-only things stay admin-only', () => {
    expect(can('exec', 'view_admin_dashboard')).toBe(false);
    expect(can('exec', 'manage_roles')).toBe(false);
  });
});

describe('permissions granted to a person or group (Admin → Access)', () => {
  it('adds exactly the granted permission on top of the role', () => {
    const hr = withGrantedCapabilities(as('alumni'), ['view_attendance_reports']);
    expect(hasCapability(hr, 'view_attendance_reports')).toBe(true);
    expect(hasCapability(hr, 'host_meetings')).toBe(false);
    expect(hasCapability(hr, 'manage_roles')).toBe(false);
  });
  it('works for someone with no role at all', () => {
    expect(hasCapability(withGrantedCapabilities([], ['view_attendance_reports']), 'view_attendance_reports')).toBe(true);
  });
  it('only attendance reports can be handed out', () => {
    expect(GRANTABLE_CAPABILITIES.map((c) => c.id)).toEqual(['view_attendance_reports']);
  });
});

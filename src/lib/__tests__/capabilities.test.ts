import { describe, expect, it } from 'vitest';
import { GRANTABLE_CAPABILITIES, hasCapability, isInactiveStripped, withGrantedCapabilities, type RoleGrant } from '@/lib/capabilities';
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
    for (const r of ['officer', 'lead', 'exec', 'recruit', 'alumni'] as AppRole[]) expect(can(r, 'view_internal_events')).toBe(true);
    for (const r of ['division'] as AppRole[]) expect(can(r, 'view_internal_events')).toBe(false);
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
    expect(GRANTABLE_CAPABILITIES.map((c) => c.id)).toEqual(['manage_strikes', 'view_attendance_reports']);
  });
  it('storage keys: the whole team can see and move them, only exec and admin manage them', () => {
    for (const r of ['officer', 'lead', 'exec', 'recruit'] as AppRole[]) expect(can(r, 'view_keys')).toBe(true);
    for (const r of ['alumni', 'division', 'ucsd'] as AppRole[]) expect(can(r, 'view_keys')).toBe(false);
    for (const r of ['exec', 'admin'] as AppRole[]) expect(can(r, 'manage_keys')).toBe(true);
    for (const r of ['lead', 'officer', 'recruit'] as AppRole[]) expect(can(r, 'manage_keys')).toBe(false);
  });
  it('strikes: exec, HR (a grant) and admins manage them; leads and officers have no access', () => {
    for (const r of ['admin', 'exec'] as AppRole[]) expect(can(r, 'manage_strikes')).toBe(true);
    for (const r of ['lead', 'officer', 'recruit', 'alumni'] as AppRole[]) expect(can(r, 'manage_strikes')).toBe(false);
    // the HR team gets it through a grant, which does not extend to the rest of exec's powers
    const hr = withGrantedCapabilities([{ role: 'officer', division_id: null }], ['manage_strikes']);
    expect(hasCapability(hr, 'manage_strikes')).toBe(true);
  });
});

describe('inactive officers and leads', () => {
  const inactiveOfficer = [{ role: 'officer' as AppRole, division_id: null }, { role: 'inactive' as AppRole, division_id: null }];
  const inactiveLead = [{ role: 'lead' as AppRole, division_id: null }, { role: 'inactive' as AppRole, division_id: null }];
  it('keep every viewing permission, QR studio and storage keys', () => {
    for (const cap of ['view_events', 'view_docs', 'view_photo_albums', 'view_members', 'view_internal_events', 'view_keys', 'view_division_members', 'generate_qr_codes'] as const) {
      expect(hasCapability(inactiveOfficer, cap)).toBe(true);
      expect(hasCapability(inactiveLead, cap)).toBe(true);
    }
  });
  it('lose checking in, scanning, and anything that manages, hosts or deletes', () => {
    for (const cap of ['checkin', 'scan_redemptions', 'manage_events', 'manage_docs', 'manage_photo_albums', 'host_meetings', 'host_internal_events'] as const) {
      expect(hasCapability(inactiveOfficer, cap)).toBe(false);
      expect(hasCapability(inactiveLead, cap)).toBe(false);
    }
  });
  it('keep attending meetings: roles skip them, but a meeting they were added to still works', () => {
    expect(hasCapability(inactiveOfficer, 'attend_meetings')).toBe(true);
    expect(hasCapability(inactiveLead, 'attend_meetings')).toBe(true);
  });
  it('are unchanged when active, and admins are never limited', () => {
    expect(hasCapability([{ role: 'officer', division_id: null }], 'checkin')).toBe(true);
    expect(hasCapability([{ role: 'lead', division_id: null }], 'manage_events')).toBe(true);
    expect(hasCapability([...inactiveLead, { role: 'admin' as AppRole, division_id: null }], 'manage_events')).toBe(true);
  });
  it('the app rule matches the database rule', () => {
    expect(isInactiveStripped('manage_whatever')).toBe(true);
    expect(isInactiveStripped('view_whatever')).toBe(false);
  });
});


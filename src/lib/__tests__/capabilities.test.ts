import { describe, expect, it } from 'vitest';
import { GRANTABLE_CAPABILITIES, hasCapability, isInactiveStripped, isRewardsEligible, withGrantedCapabilities, type RoleGrant } from '@/lib/portal/capabilities';
import type { AppRole, Capability } from '@/types/database';

const as = (...roles: AppRole[]): RoleGrant[] => roles.map((role) => ({ role, division_id: null }));
const can = (role: AppRole | null, cap: Capability) => hasCapability(role ? as(role) : [], cap);

describe('who can do what', () => {
  it('admin can do everything', () => {
    for (const cap of ['manage_roles', 'view_admin_dashboard', 'view_attendance_reports', 'manage_help'] as Capability[]) {
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
    expect(GRANTABLE_CAPABILITIES.map((c) => c.id)).toEqual(['manage_strikes', 'manage_logistics', 'send_event_emails', 'view_attendance_reports']);
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
  const inactiveOfficer = [
    { role: 'officer' as AppRole, division_id: null },
    { role: 'inactive' as AppRole, division_id: null },
  ];
  const inactiveLead = [
    { role: 'lead' as AppRole, division_id: null },
    { role: 'inactive' as AppRole, division_id: null },
  ];
  it('keep every viewing permission and QR studio', () => {
    for (const cap of ['view_events', 'view_docs', 'view_members', 'view_division_members', 'generate_qr_codes'] as const) {
      expect(hasCapability(inactiveOfficer, cap)).toBe(true);
      expect(hasCapability(inactiveLead, cap)).toBe(true);
    }
  });
  it('lose checking in, scanning, and anything that manages, hosts or deletes', () => {
    for (const cap of ['checkin', 'scan_redemptions', 'manage_events', 'manage_docs', 'host_meetings'] as const) {
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

describe('rewards are for UCSD students only', () => {
  it('a student whose only role is UCSD Student is eligible', () => {
    expect(isRewardsEligible(as('ucsd'))).toBe(true);
  });
  it('anyone with no role, or with any other role, is not', () => {
    expect(isRewardsEligible([])).toBe(false);
    for (const r of ['recruit', 'alumni', 'officer', 'lead', 'exec', 'division', 'admin'] as AppRole[]) {
      expect(isRewardsEligible(as(r))).toBe(false);
      expect(isRewardsEligible(as('ucsd', r))).toBe(false);
    }
  });
  it('a permission handed to a student directly does not make them a team member', () => {
    expect(isRewardsEligible(withGrantedCapabilities(as('ucsd'), ['view_attendance_reports']))).toBe(true);
  });
});

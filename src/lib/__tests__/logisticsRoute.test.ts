import { describe, expect, it } from 'vitest';
import { parseRoute, routeParams } from '../../app/(portal)/portal/logistics/logisticsRoute';

describe('Logistics addresses', () => {
  it('reads the new addresses', () => {
    expect(parseRoute('events', undefined, undefined, false)).toEqual({ tab: 'events', plan: null, page: 'device' });
    expect(parseRoute('events', 'ds-2026', 'prizing', false)).toEqual({ tab: 'events', plan: 'ds-2026', page: 'prizing' });
    expect(parseRoute('events', 'ds-2026', 'nope', false)).toEqual({ tab: 'events', plan: 'ds-2026', page: 'device' });
    expect(parseRoute('events', 'ds-2026', 'sponsor-prizing', false)).toEqual({ tab: 'events', plan: 'ds-2026', page: 'sponsor-prizing' });
    expect(parseRoute('events', 'ds-2026', 'prizing', false, 'day')).toEqual({ tab: 'events', plan: 'ds-2026', page: 'prizing', day: true });
    expect(parseRoute('events', 'ds-2026', 'device', false, 'day')).toEqual({ tab: 'events', plan: 'ds-2026', page: 'device', day: true });
    expect(parseRoute('events', 'ds-2026', 'allocation', false)).toEqual({ tab: 'events', plan: 'ds-2026', page: 'device' });
    expect(parseRoute('events', 'ds-2026', 'sponsor-items', false, 'day')).toEqual({ tab: 'events', plan: 'ds-2026', page: 'sponsor-items' });
    expect(parseRoute('inventory', 'prizes', undefined, false)).toEqual({ tab: 'inventory', sub: 'prizes' });
    expect(parseRoute('inventory', undefined, undefined, false)).toEqual({ tab: 'inventory', sub: 'devices' });
    expect(parseRoute('tools', 'bundles', undefined, true)).toEqual({ tab: 'tools', sub: 'bundles' });
  });
  it('still opens the old addresses', () => {
    expect(parseRoute('equipment', undefined, undefined, false)).toEqual({ tab: 'inventory', sub: 'devices' });
    expect(parseRoute('prizes', undefined, undefined, false)).toEqual({ tab: 'inventory', sub: 'prizes' });
    expect(parseRoute('plans', 'ds-2026', undefined, false)).toEqual({ tab: 'events', plan: 'ds-2026', page: 'device' });
    expect(parseRoute('sponsors', undefined, undefined, true)).toEqual({ tab: 'tools', sub: 'sponsors' });
  });
  it('keeps Tools for the people who can manage', () => {
    expect(parseRoute('tools', 'lists', undefined, false)).toEqual({ tab: 'events', plan: null, page: 'device' });
  });
  it('writes an address back', () => {
    expect(routeParams({ tab: 'events', plan: 'ds-2026', page: 'prizing' })).toEqual({ tab: 'events', subtab: 'ds-2026', detail: 'allocation-prizing', view: null });
    expect(routeParams({ tab: 'events', plan: 'ds-2026', page: 'prizing', day: true }).detail).toBe('event-day-prizing');
    expect(routeParams({ tab: 'events', plan: 'ds-2026', page: 'requests' }).detail).toBe('requests');
    expect(parseRoute('events', 'ds-2026', 'event-day-devices', false)).toEqual({ tab: 'events', plan: 'ds-2026', page: 'device', day: true });
    expect(parseRoute('events', 'ds-2026', 'allocation-sponsor-items', false)).toEqual({ tab: 'events', plan: 'ds-2026', page: 'sponsor-items' });
    expect(parseRoute('events', 'ds-2026', 'event-day-sponsor-items', false)).toEqual({ tab: 'events', plan: 'ds-2026', page: 'sponsor-items' });
    expect(routeParams({ tab: 'events', plan: 'ds-2026', page: 'device', day: true })).toEqual({ tab: 'events', subtab: 'ds-2026', detail: 'event-day-devices', view: null });
    expect(routeParams({ tab: 'events', plan: null, page: 'device' })).toEqual({ tab: 'events', subtab: null, detail: null, view: null });
    expect(routeParams({ tab: 'inventory', sub: 'devices' })).toEqual({ tab: 'inventory', subtab: 'devices', detail: null, view: null });
  });
});

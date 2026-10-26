import { describe, expect, it } from 'vitest';
import { parseRoute, routeParams, type Route } from '../../app/(portal)/portal/logistics/logisticsRoute';

// Every place has an address, and the address reads back to the same place.
const roundTrip = (r: Route) => { const p = routeParams(r); return parseRoute(p.tab ?? undefined, p.subtab ?? undefined, p.detail ?? undefined, true, p.view ?? undefined); };

describe('Logistics addresses (the event first)', () => {
  it('writes and reads every place', () => {
    const places: Route[] = [
      { tab: 'events', plan: null, page: 'requests' },
      { tab: 'events', plan: 'ds-2026', page: 'requests' },
      { tab: 'events', plan: 'ds-2026', page: 'requests-prizing' },
      { tab: 'events', plan: 'ds-2026', page: 'sponsor-loaners' },
      { tab: 'events', plan: 'ds-2026', page: 'officer-loaners' },
      { tab: 'prizing', plan: null }, { tab: 'prizing', plan: 'ds-2026' }, { tab: 'prizing', plan: 'stock' },
      { tab: 'devices', plan: null }, { tab: 'devices', plan: 'stock' }, { tab: 'devices', plan: 'stock', group: 'shelf' },
      { tab: 'devices', plan: 'ds-2026' }, { tab: 'devices', plan: 'ds-2026', day: true }, { tab: 'devices', plan: 'ds-2026', day: false, group: 'type', openOnly: true },
    ];
    for (const r of places) expect(roundTrip(r)).toEqual(r);
  });
  it('writes the addresses as documented', () => {
    expect(routeParams({ tab: 'prizing', plan: 'ds-2026' })).toEqual({ tab: 'ds-2026', subtab: 'prizing', detail: null, view: null });
    expect(routeParams({ tab: 'prizing', plan: 'stock' })).toEqual({ tab: 'stock', subtab: 'prizes', detail: null, view: null });
    expect(routeParams({ tab: 'prizing', plan: null })).toEqual({ tab: 'prizing', subtab: null, detail: null, view: null });
    expect(routeParams({ tab: 'devices', plan: 'ds-2026', day: true, group: 'shelf', openOnly: true })).toEqual({ tab: 'ds-2026', subtab: 'devices', detail: 'event-day', view: 'shelf,open' });
    expect(routeParams({ tab: 'devices', plan: 'stock' })).toEqual({ tab: 'stock', subtab: 'devices', detail: null, view: null });
    expect(routeParams({ tab: 'devices', plan: 'ds-2026', group: 'station' })).toEqual({ tab: 'ds-2026', subtab: 'devices', detail: null, view: null });
    expect(routeParams({ tab: 'events', plan: 'ds-2026', page: 'requests-prizing' })).toEqual({ tab: 'ds-2026', subtab: 'requests', detail: 'prizes', view: null });
    expect(routeParams({ tab: 'events', plan: 'ds-2026', page: 'officer-loaners' })).toEqual({ tab: 'ds-2026', subtab: 'loaners', detail: 'officer', view: null });
    expect(routeParams({ tab: 'events', plan: null, page: 'requests' })).toEqual({ tab: null, subtab: null, detail: null, view: null });
  });
  it('a bare event opens its requests', () => {
    expect(parseRoute('ds-2026', undefined, undefined, false)).toEqual({ tab: 'events', plan: 'ds-2026', page: 'requests' });
  });
});

describe('old addresses still open the right place', () => {
  it('page first', () => {
    expect(parseRoute('prizing', 'ds-2026', undefined, false)).toEqual({ tab: 'prizing', plan: 'ds-2026' });
    expect(parseRoute('devices', 'ds-2026', 'event-day', false, 'shelf')).toEqual({ tab: 'devices', plan: 'ds-2026', day: true, group: 'shelf' });
    expect(parseRoute('devices', 'ds-2026', 'planning', false)).toEqual({ tab: 'devices', plan: 'ds-2026', day: false });
  });
  it('the prize pages', () => {
    for (const w of ['allocation-prizing', 'event-day-prizing', 'allocation-sponsor-prizing', 'prizing']) expect(parseRoute('ds-2026', w, undefined, false)).toEqual({ tab: 'prizing', plan: 'ds-2026' });
    expect(parseRoute('events', 'ds-2026', 'prizing', false)).toEqual({ tab: 'prizing', plan: 'ds-2026' });
    expect(parseRoute('prizes', undefined, undefined, false)).toEqual({ tab: 'prizing', plan: 'stock' });
    expect(parseRoute('inventory', 'prizes', undefined, false)).toEqual({ tab: 'prizing', plan: 'stock' });
    expect(parseRoute('sponsors', undefined, undefined, true)).toEqual({ tab: 'prizing', plan: null });
    expect(parseRoute('tools', 'sponsors', undefined, true)).toEqual({ tab: 'prizing', plan: null });
  });
  it('the device pages', () => {
    expect(parseRoute('ds-2026', 'allocation-devices', undefined, false)).toEqual({ tab: 'devices', plan: 'ds-2026', day: false });
    expect(parseRoute('ds-2026', 'event-day-devices', undefined, false)).toEqual({ tab: 'devices', plan: 'ds-2026', day: true });
    expect(parseRoute('ds-2026', 'event-day-devices', undefined, false, 'type,open')).toEqual({ tab: 'devices', plan: 'ds-2026', day: true, group: 'type', openOnly: true });
    expect(parseRoute('events', 'ds-2026', 'device', false, 'day')).toEqual({ tab: 'devices', plan: 'ds-2026', day: true });
    expect(parseRoute('plans', 'ds-2026', 'allocation', false)).toEqual({ tab: 'devices', plan: 'ds-2026', day: false });
    expect(parseRoute('equipment', undefined, undefined, false)).toEqual({ tab: 'devices', plan: 'stock' });
    expect(parseRoute('inventory', 'devices', undefined, false)).toEqual({ tab: 'devices', plan: 'stock' });
    expect(parseRoute('inventory', undefined, undefined, false)).toEqual({ tab: 'devices', plan: 'stock' });
    expect(parseRoute('tools', 'bundles', undefined, true)).toEqual({ tab: 'devices', plan: null });
  });
  it('requests and loaners', () => {
    expect(parseRoute('ds-2026', 'requests-devices', undefined, true)).toEqual({ tab: 'events', plan: 'ds-2026', page: 'requests' });
    expect(parseRoute('ds-2026', 'requests-prizing', undefined, true)).toEqual({ tab: 'events', plan: 'ds-2026', page: 'requests-prizing' });
    expect(parseRoute('ds-2026', 'requests', 'prizes', true)).toEqual({ tab: 'events', plan: 'ds-2026', page: 'requests-prizing' });
    expect(parseRoute('ds-2026', 'allocation-sponsor-items', undefined, false)).toEqual({ tab: 'events', plan: 'ds-2026', page: 'sponsor-loaners' });
    expect(parseRoute('ds-2026', 'allocation-officer-loaners', undefined, false)).toEqual({ tab: 'events', plan: 'ds-2026', page: 'officer-loaners' });
    expect(parseRoute('events', 'ds-2026', 'allocation-sponsor-items', false)).toEqual({ tab: 'events', plan: 'ds-2026', page: 'sponsor-loaners' });
    expect(parseRoute('events', undefined, undefined, false)).toEqual({ tab: 'events', plan: null, page: 'requests' });
  });
});

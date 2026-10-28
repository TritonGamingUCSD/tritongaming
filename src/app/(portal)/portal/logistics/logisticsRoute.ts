// Where you are in Logistics, as an address: /portal/logistics/<event or place>/<page>/<detail>, the event first.
//   /portal/logistics                                    the overview (home)
//   /portal/logistics/events                             all events
//   /portal/logistics/<event>                            that event (its requests)
//   /portal/logistics/<event>/requests[/prizes]          what each team asked for, for devices or for prizes
//   /portal/logistics/<event>/loaners/sponsor|officer    the sponsor and officer loaners of the event
//   /portal/logistics/<event>/prizing                    every prize and what each station of the event gets
//   /portal/logistics/<event>/devices[/event-day|/planning]   every device and where each goes; ?view=type,open (the grouping, unfinished only)
//   /portal/logistics/stock/prizes | stock/devices       the stock, no event
//   /portal/logistics/prizing | devices                  the page, on today's (or the next) event
//   …?view=sheet                                         the same page as one big spreadsheet (every prize or device, one row each); ?view=type,sheet adds a grouping word
// The old addresses (page first like prizing/<event>, events/<event>/…, requests-devices, allocation-…, event-day-…, equipment, inventory, tools, a plan's long ID) still open the right place and are tidied to these.
import { isDeviceGroup, type DeviceGroup } from '@/lib/logistics/deviceGroups';

export const EVENT_PAGES = ['device', 'sponsor-loaners', 'officer-loaners', 'requests', 'requests-prizing'] as const;
export type EventPage = (typeof EVENT_PAGES)[number];

export type Route =
  | { tab: 'home' }
  | { tab: 'events'; plan: string | null; page: EventPage }
  | { tab: 'prizing'; plan: string | null; sheet?: boolean }
  | { tab: 'devices'; plan: string | null; day?: boolean; group?: DeviceGroup; openOnly?: boolean; sheet?: boolean };   // day: true = Event Day, false = Planning, left out = Event Day on the event's own day

// First words of an address that are not an event's name.
const RESERVED: readonly string[] = ['events', 'plans', 'inventory', 'equipment', 'prizes', 'prizing', 'devices', 'stock', 'tools', 'sponsors'];

// The grouping and "unfinished only" kept in ?view=type,open (the word of the grouping; no grouping word means by station).
const viewOf = (view?: string) => {
  const w = (view ?? '').split(',');
  return { group: (w.find((x) => isDeviceGroup(x) && x !== 'station') as DeviceGroup | undefined), openOnly: w.includes('open'), sheet: w.includes('sheet') };
};
const devices = (plan: string | null, day: boolean | undefined, view?: string): Route => { const v = viewOf(view); return { tab: 'devices', plan, ...(day !== undefined ? { day } : {}), ...(v.group ? { group: v.group } : {}), ...(v.openOnly ? { openOnly: true } : {}), ...(v.sheet ? { sheet: true } : {}) }; };
const prizing = (plan: string | null, view?: string): Route => ({ tab: 'prizing', plan, ...(viewOf(view).sheet ? { sheet: true } : {}) });
const dayOf = (word: string | undefined, view?: string): boolean | undefined => (word === 'event-day' ? true : word === 'planning' ? false : view?.split(',').includes('day') ? true : undefined);

// An event's page from its address words (the new ones, and every old one).
function eventRoute(plan: string, word: string | undefined, detail: string | undefined, view?: string): Route {
  const w = word ?? '';
  if (w === 'prizing' || (/(^|-)prizing$/.test(w) && w !== 'requests-prizing')) return prizing(plan, view);
  if (w === 'devices' || w === 'device') return devices(plan, dayOf(detail, view), view);
  if (/^(allocation|event-day)-devices?$/.test(w) || w === 'allocation' || w === 'event-day') return devices(plan, w.startsWith('event-day') ? true : w === 'allocation' || w.startsWith('allocation') ? false : undefined, view);
  if (w === '') return { tab: 'events', plan, page: 'requests' };
  if (w === 'requests') return { tab: 'events', plan, page: detail === 'prizes' ? 'requests-prizing' : 'requests' };
  if (w === 'requests-devices') return { tab: 'events', plan, page: 'requests' };
  if (w === 'requests-prizing') return { tab: 'events', plan, page: 'requests-prizing' };
  if (w === 'loaners') return { tab: 'events', plan, page: detail === 'officer' ? 'officer-loaners' : 'sponsor-loaners' };
  const old = w.replace(/^(allocation|event-day)-?/, '').replace(/^sponsor-items$/, 'sponsor-loaners');
  if (old === 'sponsor-loaners' || old === 'officer-loaners') return { tab: 'events', plan, page: old };
  return { tab: 'events', plan, page: 'requests' };
}

// Reads the address. `canManage` is only kept for the old Tools addresses, which now open the gear's pages on Devices or Prizing.
export function parseRoute(tab: string | undefined, subtab: string | undefined, detail: string | undefined, canManage: boolean, view?: string): Route {
  void canManage;
  if (!tab) return { tab: 'home' };
  if (tab && !RESERVED.includes(tab)) return eventRoute(tab, subtab, detail, view);   // /<event>/<page>
  switch (tab) {
    case 'prizing': return prizing(subtab ?? null, view);   // bare = today's event; /prizing/<event> is the old page-first form
    case 'devices': return devices(subtab ?? null, dayOf(detail, view), view);
    case 'stock': return subtab === 'devices' ? devices('stock', undefined, view) : prizing('stock', view);
    case 'inventory': return subtab === 'prizes' ? prizing('stock', view) : devices('stock', undefined, view);
    case 'equipment': return devices('stock', undefined, view);
    case 'prizes': return { tab: 'prizing', plan: 'stock' };
    case 'tools': return subtab === 'sponsors' || subtab === 'prizes' ? { tab: 'prizing', plan: null } : devices(null, undefined, view);
    case 'sponsors': return { tab: 'prizing', plan: null };
    case 'events': case 'plans': default: return subtab ? eventRoute(subtab, detail, undefined, view) : { tab: 'events', plan: null, page: 'requests' };   // /events (the list) and the old /events/<event>
  }
}

// The address params for a place (null removes a param).
export function routeParams(r: Route): { tab: string | null; subtab: string | null; detail: string | null; view: string | null } {
  const none = { tab: null, subtab: null, detail: null, view: null };
  if (r.tab === 'home') return none;
  if (r.tab === 'events') {
    if (!r.plan) return { ...none, tab: 'events' };
    switch (r.page) {
      case 'requests': return { tab: r.plan, subtab: 'requests', detail: null, view: null };
      case 'requests-prizing': return { tab: r.plan, subtab: 'requests', detail: 'prizes', view: null };
      case 'sponsor-loaners': return { tab: r.plan, subtab: 'loaners', detail: 'sponsor', view: null };
      case 'officer-loaners': return { tab: r.plan, subtab: 'loaners', detail: 'officer', view: null };
      default: return { tab: r.plan, subtab: 'devices', detail: null, view: null };
    }
  }
  if (r.tab === 'prizing') { const v = r.sheet ? 'sheet' : null; return !r.plan ? { ...none, tab: 'prizing', view: v } : r.plan === 'stock' ? { ...none, tab: 'stock', subtab: 'prizes', view: v } : { ...none, tab: r.plan, subtab: 'prizing', view: v }; }
  const view = [r.group && r.group !== 'station' ? r.group : '', r.openOnly ? 'open' : '', r.sheet ? 'sheet' : ''].filter(Boolean).join(',') || null;
  if (!r.plan) return { ...none, tab: 'devices', view };
  if (r.plan === 'stock') return { ...none, tab: 'stock', subtab: 'devices', view };
  return { tab: r.plan, subtab: 'devices', detail: r.day === undefined ? null : r.day ? 'event-day' : 'planning', view };
}

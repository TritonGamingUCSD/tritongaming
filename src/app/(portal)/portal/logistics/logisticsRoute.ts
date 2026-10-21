// Where you are in Logistics, as an address: /portal/logistics/<tab>/<subtab>/<detail>.
//   events                         the list of events          events/<name>/requests             what each team asked for
//   events/<name>/allocation-<what>  devices | prizing | sponsor-prizing | sponsor-items | officer-loaners    (without a page: allocation-devices)
//   events/<name>/event-day-<what>   devices | prizing         inventory/devices | prizes     what is in storage         tools/<section>    sponsors | event-steps | bundles | prizes | lists
// The old addresses (device, prizing, sponsor-items … with or without ?view=day, /allocation, equipment, plans, a plan's long ID) still open the right place and are tidied to the new ones.

export const EVENT_PAGES = ['device', 'prizing', 'sponsor-prizing', 'sponsor-items', 'officer-loaners', 'requests'] as const;
export type EventPage = (typeof EVENT_PAGES)[number];
export const TOOLS_SECTIONS = ['sponsors', 'event-steps', 'bundles', 'prizes', 'lists'] as const;
export type ToolsSection = (typeof TOOLS_SECTIONS)[number];

export type Route =
  | { tab: 'events'; plan: string | null; page: EventPage; day?: boolean }
  | { tab: 'inventory'; sub: 'devices' | 'prizes' }
  | { tab: 'tools'; sub: ToolsSection };

const oneOf = <T extends string>(list: readonly T[], v: string | undefined | null, fallback: T): T => (list as readonly string[]).includes(v ?? '') ? (v as T) : fallback;

// Reads the address. `canManage` says whether Tools may be used (anyone else is taken to Events).
export function parseRoute(tab: string | undefined, subtab: string | undefined, detail: string | undefined, canManage: boolean, view?: string): Route {
  switch (tab) {
    case 'inventory': return { tab: 'inventory', sub: oneOf(['devices', 'prizes'] as const, subtab, 'devices') };
    case 'equipment': return { tab: 'inventory', sub: 'devices' };
    case 'prizes': return { tab: 'inventory', sub: 'prizes' };
    case 'tools': return canManage ? { tab: 'tools', sub: oneOf(TOOLS_SECTIONS, subtab, 'sponsors') } : { tab: 'events', plan: null, page: 'device' };
    case 'sponsors': return canManage ? { tab: 'tools', sub: 'sponsors' } : { tab: 'events', plan: null, page: 'device' };
    case 'events': case 'plans': default: {
      if (!subtab) return { tab: 'events', plan: null, page: 'device' };
      const d = detail ?? '';
      const day = d.startsWith('event-day-') || ((d === 'device' || d === 'prizing') && view === 'day');
      const word = d.replace(/^(allocation|event-day)-?/, '').replace(/^devices?$/, 'device');
      const page = oneOf(EVENT_PAGES, d === 'requests' ? 'requests' : word, 'device');
      return { tab: 'events', plan: subtab, page, ...(day && (page === 'prizing' || page === 'device') ? { day: true } : {}) };
    }
  }
}

// The address params for a place (null removes a param).
export function routeParams(r: Route): { tab: string; subtab: string | null; detail: string | null; view: string | null } {
  if (r.tab === 'events') {
    const what = r.page === 'device' ? 'devices' : r.page;
    return { tab: 'events', subtab: r.plan, detail: r.plan ? (r.page === 'requests' ? 'requests' : `${r.day && (r.page === 'device' || r.page === 'prizing') ? 'event-day' : 'allocation'}-${what}`) : null, view: null };
  }
  return { tab: r.tab, subtab: r.sub, detail: null, view: null };
}

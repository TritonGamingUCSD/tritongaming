// Where you are in Logistics, as an address: /portal/logistics/<tab>/<subtab>/<detail>.
//   /portal/logistics                  the list of events        /portal/logistics/<event>/requests      what each team asked for
//   /portal/logistics/<event>/allocation-<what>   devices | prizing | sponsor-prizing | sponsor-items | officer-loaners
//   /portal/logistics/<event>/event-day-<what>    devices | prizing        inventory/devices | prizes     what is in storage         tools/<section>    sponsors | event-steps | bundles | prizes | lists
// The old addresses (events/<event>/…, device, prizing … with or without ?view=day, equipment, plans, a plan's long ID) still open the right place and are tidied to the new ones.

export const EVENT_PAGES = ['device', 'prizing', 'sponsor-prizing', 'sponsor-items', 'officer-loaners', 'requests'] as const;
export type EventPage = (typeof EVENT_PAGES)[number];
export const TOOLS_SECTIONS = ['sponsors', 'event-steps', 'bundles', 'prizes', 'lists'] as const;
export type ToolsSection = (typeof TOOLS_SECTIONS)[number];

export type Route =
  | { tab: 'events'; plan: string | null; page: EventPage; day?: boolean }
  | { tab: 'inventory'; sub: 'devices' | 'prizes' }
  | { tab: 'tools'; sub: ToolsSection };

const oneOf = <T extends string>(list: readonly T[], v: string | undefined | null, fallback: T): T => (list as readonly string[]).includes(v ?? '') ? (v as T) : fallback;

const TAB_WORDS: readonly string[] = ['events', 'plans', 'inventory', 'equipment', 'prizes', 'tools', 'sponsors'];

// An event's page from its address word: requests, allocation-devices, event-day-prizing… (the older bare words device / prizing, with ?view=day, still read).
function eventRoute(plan: string, d: string | undefined, view?: string): Route {
  const w = d ?? '';
  const day = w.startsWith('event-day-') || ((w === 'device' || w === 'prizing') && view === 'day');
  const word = w.replace(/^(allocation|event-day)-?/, '').replace(/^devices?$/, 'device');
  const page = oneOf(EVENT_PAGES, w === 'requests' ? 'requests' : word, 'device');
  return { tab: 'events', plan, page, ...(day && (page === 'prizing' || page === 'device') ? { day: true } : {}) };
}

// Reads the address. `canManage` says whether Tools may be used (anyone else is taken to Events).
export function parseRoute(tab: string | undefined, subtab: string | undefined, detail: string | undefined, canManage: boolean, view?: string): Route {
  if (tab && !TAB_WORDS.includes(tab)) return eventRoute(tab, subtab, view);   // /<event>/<page>
  switch (tab) {
    case 'inventory': return { tab: 'inventory', sub: oneOf(['devices', 'prizes'] as const, subtab, 'devices') };
    case 'equipment': return { tab: 'inventory', sub: 'devices' };
    case 'prizes': return { tab: 'inventory', sub: 'prizes' };
    case 'tools': return canManage ? { tab: 'tools', sub: oneOf(TOOLS_SECTIONS, subtab, 'sponsors') } : { tab: 'events', plan: null, page: 'device' };
    case 'sponsors': return canManage ? { tab: 'tools', sub: 'sponsors' } : { tab: 'events', plan: null, page: 'device' };
    case 'events': case 'plans': default: return subtab ? eventRoute(subtab, detail, view) : { tab: 'events', plan: null, page: 'device' };
  }
}

// The address params for a place (null removes a param).
export function routeParams(r: Route): { tab: string | null; subtab: string | null; detail: string | null; view: string | null } {
  if (r.tab === 'events') {
    if (!r.plan) return { tab: null, subtab: null, detail: null, view: null };
    const what = r.page === 'device' ? 'devices' : r.page;
    return { tab: r.plan, subtab: r.page === 'requests' ? 'requests' : `${r.day && (r.page === 'device' || r.page === 'prizing') ? 'event-day' : 'allocation'}-${what}`, detail: null, view: null };
  }
  return { tab: r.tab, subtab: r.sub, detail: null, view: null };
}

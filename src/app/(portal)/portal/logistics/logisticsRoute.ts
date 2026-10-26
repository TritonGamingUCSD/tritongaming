// Where you are in Logistics, as an address: /portal/logistics/<tab>/<subtab>/<detail>.
//   /portal/logistics                  the list of events        /portal/logistics/<event>/requests-devices | requests-prizing   what each team asked for
//   /portal/logistics/<event>/allocation-<what>   devices | sponsor-loaners | officer-loaners         /portal/logistics/<event>/event-day-devices
//   /portal/logistics/prizing[/<event>]           every prize and what each station of an event gets (the event is picked on the page; "stock" = no event)
//   inventory/devices   what is in storage         tools/<section>    event-steps | bundles | lists
// The old addresses (events/<event>/…, device, prizing … with or without ?view=day, equipment, plans, a plan's long ID) still open the right place and are tidied to the new ones.

export const EVENT_PAGES = ['device', 'sponsor-loaners', 'officer-loaners', 'requests', 'requests-prizing'] as const;
export type EventPage = (typeof EVENT_PAGES)[number];
export const TOOLS_SECTIONS = ['event-steps', 'bundles', 'lists'] as const;
export type ToolsSection = (typeof TOOLS_SECTIONS)[number];

export type Route =
  | { tab: 'events'; plan: string | null; page: EventPage; day?: boolean; byType?: boolean; openOnly?: boolean }
  | { tab: 'prizing'; plan: string | null }
  | { tab: 'inventory'; sub: 'devices' }
  | { tab: 'tools'; sub: ToolsSection };

const oneOf = <T extends string>(list: readonly T[], v: string | undefined | null, fallback: T): T => (list as readonly string[]).includes(v ?? '') ? (v as T) : fallback;

const TAB_WORDS: readonly string[] = ['events', 'plans', 'inventory', 'equipment', 'prizes', 'prizing', 'tools', 'sponsors'];

// An event's page from its address word: requests, allocation-devices, event-day-prizing… (the older bare words device / prizing, with ?view=day, still read).
function eventRoute(plan: string, d: string | undefined, view?: string): Route {
  const w = d ?? '';
  // The old prize pages (allocation, event day, sponsor prizing) are all the Prizing page now.
  if (/(^|-)prizing$/.test(w) && w !== 'requests-prizing') return { tab: 'prizing', plan };
  const day = w.startsWith('event-day-') || (w === 'device' && view === 'day');
  const word = w.replace(/^(allocation|event-day)-?/, '').replace(/^devices?$/, 'device').replace(/^sponsor-items$/, 'sponsor-loaners');
  const page = oneOf(EVENT_PAGES, w === 'requests' || w === 'requests-devices' ? 'requests' : w === 'requests-prizing' ? 'requests-prizing' : word, 'device');
  return { tab: 'events', plan, page, ...(day && page === 'device' ? { day: true } : {}), ...(page === 'device' && view?.split(',').includes('type') ? { byType: true } : {}), ...(day && page === 'device' && view?.split(',').includes('open') ? { openOnly: true } : {}) };
}

// Reads the address. `canManage` says whether Tools may be used (anyone else is taken to Events).
export function parseRoute(tab: string | undefined, subtab: string | undefined, detail: string | undefined, canManage: boolean, view?: string): Route {
  if (tab && !TAB_WORDS.includes(tab)) return eventRoute(tab, subtab, view);   // /<event>/<page>
  switch (tab) {
    case 'prizing': return { tab: 'prizing', plan: subtab ?? null };
    case 'inventory': return subtab === 'prizes' ? { tab: 'prizing', plan: 'stock' } : { tab: 'inventory', sub: 'devices' };
    case 'equipment': return { tab: 'inventory', sub: 'devices' };
    case 'prizes': return { tab: 'prizing', plan: 'stock' };
    case 'tools': return canManage ? (subtab === 'sponsors' || subtab === 'prizes' ? { tab: 'prizing', plan: null } : { tab: 'tools', sub: oneOf(TOOLS_SECTIONS, subtab, 'event-steps') }) : { tab: 'events', plan: null, page: 'device' };
    case 'sponsors': return { tab: 'prizing', plan: null };
    case 'events': case 'plans': default: return subtab ? eventRoute(subtab, detail, view) : { tab: 'events', plan: null, page: 'device' };
  }
}

// The address params for a place (null removes a param).
export function routeParams(r: Route): { tab: string | null; subtab: string | null; detail: string | null; view: string | null } {
  if (r.tab === 'events') {
    if (!r.plan) return { tab: null, subtab: null, detail: null, view: null };
    const what = r.page === 'device' ? 'devices' : r.page;
    return { tab: r.plan, subtab: r.page === 'requests' ? 'requests-devices' : r.page === 'requests-prizing' ? 'requests-prizing' : `${r.day && r.page === 'device' ? 'event-day' : 'allocation'}-${what}`, detail: null, view: [r.byType && r.page === 'device' ? 'type' : '', r.openOnly && r.day && r.page === 'device' ? 'open' : ''].filter(Boolean).join(',') || null };
  }
  if (r.tab === 'prizing') return { tab: 'prizing', subtab: r.plan, detail: null, view: null };
  return { tab: r.tab, subtab: r.sub, detail: null, view: null };
}

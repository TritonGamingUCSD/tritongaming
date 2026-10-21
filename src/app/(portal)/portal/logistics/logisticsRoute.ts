// Where you are in Logistics, as an address: /portal/logistics/<tab>/<subtab>/<detail>.
//   events                         the list of events          events/<name>                      an event (its Allocation)
//                                                              events/<name>/<page>               allocation | prizing | sponsor-prizing | sponsor-items | officer-loaners | requests
//                                                              events/<name>/prizing?view=day      the prize event-day counts (without it, the allocation grid)
//   inventory/devices | prizes     what is in storage         tools/<section>                    sponsors | event-steps | bundles | prizes | lists
// The old addresses (equipment, plans, prizes, sponsors at the top level, and a plan's long ID) still open the right place and are tidied to the new ones.

export const EVENT_PAGES = ['allocation', 'prizing', 'sponsor-prizing', 'sponsor-items', 'officer-loaners', 'requests'] as const;
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
    case 'tools': return canManage ? { tab: 'tools', sub: oneOf(TOOLS_SECTIONS, subtab, 'sponsors') } : { tab: 'events', plan: null, page: 'allocation' };
    case 'sponsors': return canManage ? { tab: 'tools', sub: 'sponsors' } : { tab: 'events', plan: null, page: 'allocation' };
    case 'events': case 'plans': default: { const page = subtab ? oneOf(EVENT_PAGES, detail, 'allocation') : 'allocation'; return { tab: 'events', plan: subtab ?? null, page, ...(page === 'prizing' && view === 'day' ? { day: true } : {}) }; }
  }
}

// The address params for a place (null removes a param).
export function routeParams(r: Route): { tab: string; subtab: string | null; detail: string | null; view: string | null } {
  if (r.tab === 'events') return { tab: 'events', subtab: r.plan, detail: r.plan ? r.page : null, view: r.plan && r.page === 'prizing' && r.day ? 'day' : null };
  return { tab: r.tab, subtab: r.sub, detail: null, view: null };
}

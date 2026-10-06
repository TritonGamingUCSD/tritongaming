// The portal's address: /portal/<section>/<tab>/<subtab>. Everything else (an open doc, a search, a filter) stays in the
// query string. next.config.ts rewrites these paths to the hub's /portal?section=…&tab=…&subtab=… on a fresh load, so the
// server page keeps reading the old params; in the browser the address is updated with the history API (no refetch).

export const PORTAL_SECTION_IDS = [
  'calendar', 'tickets', 'points', 'activity', 'profile', 'events', 'checkin', 'members', 'meetings', 'internal-events',
  'keys', 'strikes', 'quarters', 'divisions', 'division-members', 'docs', 'qrcode', 'albums', 'help', 'admin', 'site-content', 'shifts',
] as const;

const SECTIONS = new Set<string>(PORTAL_SECTION_IDS);
const PATH_KEYS = ['section', 'tab', 'subtab'] as const;

/** section/tab/subtab from a pathname like /portal/docs/read/x, or null when it isn't a hub path. */
export function parsePortalPath(pathname: string): { section: string; tab?: string; subtab?: string } | null {
  const parts = pathname.replace(/^\/portal\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  if (!pathname.startsWith('/portal') || !parts.length || !SECTIONS.has(parts[0])) return null;
  return { section: parts[0], tab: parts[1], subtab: parts[2] };
}

/** The params as the hub understands them: path segments folded into the query's section/tab/subtab. */
export function mergedPortalParams(pathname: string, search: string): URLSearchParams {
  const params = new URLSearchParams(search);
  const fromPath = parsePortalPath(pathname);
  if (fromPath) {
    params.set('section', fromPath.section);
    if (fromPath.tab) params.set('tab', fromPath.tab); else params.delete('tab');
    if (fromPath.subtab) params.set('subtab', fromPath.subtab); else params.delete('subtab');
  }
  return params;
}

/** Builds the address for a set of params: section/tab/subtab go in the path, the rest stay in the query. */
export function portalHref(params: URLSearchParams): string {
  const rest = new URLSearchParams(params);
  PATH_KEYS.forEach((k) => rest.delete(k));
  const section = params.get('section');
  let path = '/portal';
  if (section && SECTIONS.has(section)) {
    const tab = params.get('tab');
    const subtab = tab ? params.get('subtab') : null;
    path += `/${section}${tab ? `/${encodeURIComponent(tab)}` : ''}${subtab ? `/${encodeURIComponent(subtab)}` : ''}`;
  }
  const qs = rest.toString();
  return `${path}${qs ? `?${qs}` : ''}`;
}

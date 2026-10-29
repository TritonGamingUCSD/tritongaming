// Where you are in Staffle, as an address: /portal/staffle (the list), /portal/staffle/<name> (one Staffle), /portal/staffle/<name>/draw (the draw, full screen), /portal/staffle/new (making one).
export type StaffleRoute = { view: 'list' } | { view: 'new' } | { view: 'one'; slug: string } | { view: 'draw'; slug: string };

export function parseStaffleRoute(tab: string | undefined, subtab: string | undefined, canManage: boolean): StaffleRoute {
  if (!tab) return { view: 'list' };
  if (tab === 'new') return canManage ? { view: 'new' } : { view: 'list' };
  return subtab === 'draw' && canManage ? { view: 'draw', slug: tab } : { view: 'one', slug: tab };
}

export function staffleParams(r: StaffleRoute): { tab: string | null; subtab: string | null } {
  switch (r.view) {
    case 'list':
      return { tab: null, subtab: null };
    case 'new':
      return { tab: 'new', subtab: null };
    case 'one':
      return { tab: r.slug, subtab: null };
    case 'draw':
      return { tab: r.slug, subtab: 'draw' };
  }
}

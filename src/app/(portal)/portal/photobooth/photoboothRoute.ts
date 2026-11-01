// Where you are in the Photo Booth, as an address: /portal/photobooth/<tab>/<detail>.
//   /portal/photobooth                  the events a booth can be set up for      /portal/photobooth/overlays      the overlay library
//   /portal/photobooth/<event>          that event's booth settings               /portal/photobooth/<event>/run   the booth itself (the whole screen)

export type PhotoBoothRoute = { tab: 'booths' } | { tab: 'overlays' } | { tab: 'setup'; event: string } | { tab: 'run'; event: string };

export function parsePhotoBoothRoute(tab: string | undefined, subtab: string | undefined): PhotoBoothRoute {
  if (!tab || tab === 'booths') return { tab: 'booths' };
  if (tab === 'overlays') return { tab: 'overlays' };
  return subtab === 'run' ? { tab: 'run', event: tab } : { tab: 'setup', event: tab };
}

export function photoBoothParams(r: PhotoBoothRoute): { tab: string; subtab: string | null; detail: null } {
  switch (r.tab) {
    case 'booths':
      return { tab: 'booths', subtab: null, detail: null };
    case 'overlays':
      return { tab: 'overlays', subtab: null, detail: null };
    case 'setup':
      return { tab: r.event, subtab: null, detail: null };
    case 'run':
      return { tab: r.event, subtab: 'run', detail: null };
  }
}

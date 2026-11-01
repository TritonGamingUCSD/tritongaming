// Where you are in the Photo Booth, as an address: /portal/photobooth/<tab>/<detail>.
//   /portal/photobooth                  the booths                                /portal/photobooth/overlays      the overlay library
//   /portal/photobooth/<booth>          that booth's settings                     /portal/photobooth/<booth>/run   the booth itself (the whole screen)

export type PhotoBoothRoute = { tab: 'booths' } | { tab: 'overlays' } | { tab: 'setup'; booth: string } | { tab: 'run'; booth: string };

export function parsePhotoBoothRoute(tab: string | undefined, subtab: string | undefined): PhotoBoothRoute {
  if (!tab || tab === 'booths') return { tab: 'booths' };
  if (tab === 'overlays') return { tab: 'overlays' };
  return subtab === 'run' ? { tab: 'run', booth: tab } : { tab: 'setup', booth: tab };
}

export function photoBoothParams(r: PhotoBoothRoute): { tab: string; subtab: string | null; detail: null } {
  switch (r.tab) {
    case 'booths':
      return { tab: 'booths', subtab: null, detail: null };
    case 'overlays':
      return { tab: 'overlays', subtab: null, detail: null };
    case 'setup':
      return { tab: r.booth, subtab: null, detail: null };
    case 'run':
      return { tab: r.booth, subtab: 'run', detail: null };
  }
}

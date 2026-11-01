// Where you are in the Photo Booth, as an address: /portal/photobooth/<tab>/<detail>.
//   /portal/photobooth                  the booths                                /portal/photobooth/overlays      the sticker library      /portal/photobooth/overlays/text   the text sticker designer
//   /portal/photobooth/<booth>          that booth's settings                     /portal/photobooth/<booth>/run   the booth itself (the whole screen)

export type PhotoBoothRoute = { tab: 'booths' } | { tab: 'new' } | { tab: 'overlays' } | { tab: 'text' } | { tab: 'setup'; booth: string } | { tab: 'run'; booth: string };

export function parsePhotoBoothRoute(tab: string | undefined, subtab: string | undefined): PhotoBoothRoute {
  if (!tab || tab === 'booths') return { tab: 'booths' };
  if (tab === 'new') return { tab: 'new' };
  if (tab === 'overlays') return subtab === 'text' ? { tab: 'text' } : { tab: 'overlays' };
  return subtab === 'run' ? { tab: 'run', booth: tab } : { tab: 'setup', booth: tab };
}

export function photoBoothParams(r: PhotoBoothRoute): { tab: string; subtab: string | null; detail: null } {
  switch (r.tab) {
    case 'booths':
      return { tab: 'booths', subtab: null, detail: null };
    case 'overlays':
      return { tab: 'overlays', subtab: null, detail: null };
    case 'new':
      return { tab: 'new', subtab: null, detail: null };
    case 'text':
      return { tab: 'overlays', subtab: 'text', detail: null };
    case 'setup':
      return { tab: r.booth, subtab: null, detail: null };
    case 'run':
      return { tab: r.booth, subtab: 'run', detail: null };
  }
}

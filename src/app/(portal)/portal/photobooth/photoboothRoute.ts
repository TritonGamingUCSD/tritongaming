// Where you are in the Photo Booth, as an address: /portal/photobooth/<tab>/<detail>.
//   /portal/photobooth                    the booths                       /portal/photobooth/new              Make A Booth
//   /portal/photobooth/<booth>            that booth's studio (Photos)     /portal/photobooth/<booth>/<tool>   one of its tools: frame, stickers, look, words, downloads, pictures
//   /portal/photobooth/<booth>/run        the booth itself (the whole screen)      /portal/photobooth/<booth>/test   a test run of it (nothing is saved)

export const STUDIO_TOOLS = ['photos', 'frame', 'stickers', 'look', 'words', 'downloads', 'pictures'] as const;
export type StudioTool = (typeof STUDIO_TOOLS)[number];

export type PhotoBoothRoute = { tab: 'booths' } | { tab: 'new' } | { tab: 'setup'; booth: string; tool: StudioTool } | { tab: 'run'; booth: string; test?: boolean };

export function parsePhotoBoothRoute(tab: string | undefined, subtab: string | undefined): PhotoBoothRoute {
  if (!tab || tab === 'booths') return { tab: 'booths' };
  if (tab === 'new') return { tab: 'new' };
  if (subtab === 'run') return { tab: 'run', booth: tab };
  if (subtab === 'test') return { tab: 'run', booth: tab, test: true };
  return { tab: 'setup', booth: tab, tool: (STUDIO_TOOLS as readonly string[]).includes(subtab ?? '') ? (subtab as StudioTool) : 'photos' };
}

export function photoBoothParams(r: PhotoBoothRoute): { tab: string; subtab: string | null; detail: null } {
  switch (r.tab) {
    case 'booths':
    case 'new':
      return { tab: r.tab, subtab: null, detail: null };
    case 'setup':
      return { tab: r.booth, subtab: r.tool === 'photos' ? null : r.tool, detail: null };
    case 'run':
      return { tab: r.booth, subtab: r.test ? 'test' : 'run', detail: null };
  }
}

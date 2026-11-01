// Where you are in the Photo Booth, as an address: /portal/photobooth/<tab>/<detail>.
//   /portal/photobooth                    the booths                       /portal/photobooth/new              Make A Booth
//   /portal/photobooth/<booth>            that booth's studio (Photos)     /portal/photobooth/<booth>/<tool>   one of its tools: frame, stickers, look, words, downloads, pictures
//   /portal/photobooth/<booth>/<tool>/<look>   the same tool for one of its looks (the first 8 letters of the look's id; the first look when left out)
//   /portal/photobooth/<booth>/run        the booth itself (the whole screen)      /portal/photobooth/<booth>/test   a test run of it (nothing is saved)

export const STUDIO_TOOLS = ['photos', 'frame', 'stickers', 'look', 'words', 'downloads', 'pictures'] as const;
export type StudioTool = (typeof STUDIO_TOOLS)[number];

export type PhotoBoothRoute = { tab: 'booths' } | { tab: 'new' } | { tab: 'setup'; booth: string; tool: StudioTool; look?: string } | { tab: 'run'; booth: string; test?: boolean };

export function parsePhotoBoothRoute(tab: string | undefined, subtab: string | undefined, detail?: string): PhotoBoothRoute {
  if (!tab || tab === 'booths') return { tab: 'booths' };
  if (tab === 'new') return { tab: 'new' };
  if (subtab === 'run') return { tab: 'run', booth: tab };
  if (subtab === 'test') return { tab: 'run', booth: tab, test: true };
  return { tab: 'setup', booth: tab, tool: (STUDIO_TOOLS as readonly string[]).includes(subtab ?? '') ? (subtab as StudioTool) : 'photos', ...(detail ? { look: detail } : {}) };
}

export function photoBoothParams(r: PhotoBoothRoute): { tab: string; subtab: string | null; detail: string | null } {
  switch (r.tab) {
    case 'booths':
    case 'new':
      return { tab: r.tab, subtab: null, detail: null };
    case 'setup':
      return { tab: r.booth, subtab: r.tool === 'photos' && !r.look ? null : r.tool, detail: r.look ?? null };
    case 'run':
      return { tab: r.booth, subtab: r.test ? 'test' : 'run', detail: null };
  }
}

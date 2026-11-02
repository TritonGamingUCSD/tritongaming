import type { BoothSettings, FrameSpec, LookStyle, Overlay, Placement } from '@/lib/photobooth/booth';

import { call } from '@/lib/ui/apiCall';
import { safeFetch } from '@/lib/ui/safeFetch';

export { call };

export interface BoothRow {
  id: string;
  slug: string;
  name: string;
  looks: number;
  created_at: string;
  photos: number;
  look: LookData | null; // its first look, for the card's small picture
}
export interface BoothData {
  booth: { id: string; slug: string; name: string; gallery_token: string };
  config: BoothSettings;
  looks: LookData[];
}
export interface LookData {
  id: string;
  name: string;
  style: LookStyle;
  frame: { image: string; spec: FrameSpec | null };
  overlays: Overlay[];
}

/** Adds one sticker (a WebP file made in the browser: a picture, or words drawn) to a look. */
export async function uploadSticker(
  look: string,
  opts: {
    name: string;
    blob: Blob;
    sticker?: { placements: (Placement | null)[] };
  },
): Promise<{ ok: true; overlay: Overlay } | { ok: false; error: string }> {
  const form = new FormData();
  form.append('name', opts.name);
  form.append('file', new File([opts.blob], 'sticker.webp', { type: 'image/webp' }));
  if (opts.sticker) form.append('placements', JSON.stringify(opts.sticker.placements));
  const res = await fetch(`/api/photobooth/looks/${look}/stickers`, { method: 'POST', body: form, cache: 'no-store' }).catch(() => null);
  const json = res ? await res.json().catch(() => ({})) : {};
  return res?.ok ? { ok: true, overlay: json.overlay as Overlay } : { ok: false, error: json.error ?? 'Couldn’t reach the server.' };
}

/** Saves a look's own frame: the picture the page drew, what it is made of and (when it is new) the logo file. */
export async function saveFrame(
  look: string,
  opts: { frame: Blob; spec: FrameSpec; logo?: Blob | null },
): Promise<{ ok: true; frame: { image: string; spec: FrameSpec } } | { ok: false; error: string }> {
  const form = new FormData();
  form.append('frame', new File([opts.frame], 'frame.webp', { type: 'image/webp' }));
  form.append('design', JSON.stringify(opts.spec));
  if (opts.logo) form.append('logo', new File([opts.logo], 'logo.webp', { type: 'image/webp' }));
  const res = await safeFetch(`/api/photobooth/looks/${look}/frame`, { method: 'PUT', body: form, cache: 'no-store' }).catch(() => null);
  const json = res ? await res.json().catch(() => ({})) : {};
  return res?.ok ? { ok: true, frame: json.frame } : { ok: false, error: json.error ?? 'Couldn’t reach the server.' };
}

/** Saves where a look's stickers sit, how big and on which photos, in the order given. */
export async function saveStickers(look: string, stickers: Overlay[]): Promise<{ ok: true; overlays: Overlay[] } | { ok: false; error: string }> {
  const r = await call<{ overlays: Overlay[] }>(`/api/photobooth/looks/${look}/stickers`, 'PUT', { stickers });
  return r.ok ? { ok: true, overlays: r.data.overlays } : { ok: false, error: r.error };
}

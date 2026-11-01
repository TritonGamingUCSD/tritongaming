import type { BoothConfig, FrameSpec, Overlay } from '@/lib/photobooth/booth';

import { call } from '@/lib/ui/apiCall';

export { call };

export interface BoothRow {
  id: string;
  slug: string;
  name: string;
  layout: string;
  created_at: string;
  photos: number;
}
export interface BoothData {
  booth: { id: string; slug: string; name: string };
  config: BoothConfig;
  overlays: Overlay[];
  frame: { image: string; spec: FrameSpec | null };
}

/** Adds one sticker (a WebP file made in the browser: a picture, or words drawn) to a booth. */
export async function uploadSticker(
  booth: string,
  opts: {
    name: string;
    blob: Blob;
    sticker?: { x: number; y: number; size: number; can_resize: boolean; can_rotate: boolean };
  },
): Promise<{ ok: true; overlay: Overlay } | { ok: false; error: string }> {
  const form = new FormData();
  form.append('name', opts.name);
  form.append('file', new File([opts.blob], 'sticker.webp', { type: 'image/webp' }));
  for (const [k, v] of Object.entries(opts.sticker ?? {})) form.append(k, String(v));
  const res = await fetch(`/api/photobooth/booths/${booth}/stickers`, { method: 'POST', body: form, cache: 'no-store' }).catch(() => null);
  const json = res ? await res.json().catch(() => ({})) : {};
  return res?.ok ? { ok: true, overlay: json.overlay as Overlay } : { ok: false, error: json.error ?? 'Couldn’t reach the server.' };
}

/** Saves a booth's own frame: the picture the page drew, what it is made of and (when it is new) the logo file. */
export async function saveFrame(
  booth: string,
  opts: { frame: Blob; spec: FrameSpec; logo?: Blob | null },
): Promise<{ ok: true; frame: { image: string; spec: FrameSpec } } | { ok: false; error: string }> {
  const form = new FormData();
  form.append('frame', new File([opts.frame], 'frame.webp', { type: 'image/webp' }));
  form.append('design', JSON.stringify(opts.spec));
  if (opts.logo) form.append('logo', new File([opts.logo], 'logo.webp', { type: 'image/webp' }));
  const res = await fetch(`/api/photobooth/booths/${booth}/frame`, { method: 'PUT', body: form, cache: 'no-store' }).catch(() => null);
  const json = res ? await res.json().catch(() => ({})) : {};
  return res?.ok ? { ok: true, frame: json.frame } : { ok: false, error: json.error ?? 'Couldn’t reach the server.' };
}

/** Saves where a booth's stickers start, how big and what a guest may do with them, in the order given. */
export async function saveStickers(booth: string, stickers: Overlay[]): Promise<{ ok: true; overlays: Overlay[] } | { ok: false; error: string }> {
  const r = await call<{ overlays: Overlay[] }>(`/api/photobooth/booths/${booth}/stickers`, 'PUT', { stickers });
  return r.ok ? { ok: true, overlays: r.data.overlays } : { ok: false, error: r.error };
}

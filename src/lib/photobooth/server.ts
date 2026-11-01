import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { hasCapability, withGrantedCapabilities } from '@/lib/portal/capabilities';
import { loadGrantedCapabilities } from '@/lib/portal/grantedCapabilities';
import { cleanBooth, cleanFrameSpec, type BoothConfig, type FrameSpec, type Overlay } from '@/lib/photobooth/booth';

export const UUID = /^[0-9a-f-]{36}$/i;
export const OVERLAY_BUCKET = 'photobooth-overlays';
export const PHOTO_BUCKET = 'photobooth';
export const MAX_OVERLAY_BYTES = 600 * 1024; // the bucket refuses anything over 614400 bytes too
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
export const OVERLAY_COLUMNS = 'id, name, kind, image, x, y, size, can_resize, can_rotate';
export const BOOTH_COLUMNS =
  'id, slug, name, frame_image, frame_design, layout, aspect, countdown, mirror, filter, strip_bg, text_color, accent, footer, welcome_title, welcome_text, prompts, sounds, flash, qr_seconds, keep_days, overlay_ids';

// Who may set up and run a booth: officers and above (the capability can also be granted in Admin → Access). The guests' download page needs no sign-in and has its own routes.
export async function authorizePhotoBooth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const svc = createServiceClient();
  const { data: roles } = await supabase.from('user_roles').select('role, division_id').eq('user_id', user.id);
  const grants = withGrantedCapabilities(roles ?? [], await loadGrantedCapabilities(svc, user.id).catch(() => []));
  if (!hasCapability(grants, 'run_photobooth')) return { error: NextResponse.json({ error: 'Running the Photo Booth is for officers and above.' }, { status: 403 }) };
  return { user, svc };
}

export interface BoothInfo {
  id: string;
  slug: string;
  name: string;
}

/** Words that are other addresses under /portal/photobooth, so a booth cannot take them as its own. */
export const RESERVED_SLUGS = ['booths', 'overlays', 'new'];

/** A booth with its settings, its frame and the stickers it offers, by its address word (or id). */
export interface BoothFrame {
  /** The public address of the frame picture, or '' for none. */
  image: string;
  /** What it is made of, or null when there is no frame designed. */
  spec: FrameSpec | null;
}

export async function loadBooth(svc: SupabaseClient, key: string): Promise<{ booth: BoothInfo; config: BoothConfig; overlays: Overlay[]; frame: BoothFrame } | null> {
  const q = svc.from('photobooths').select(BOOTH_COLUMNS);
  const { data } = await (UUID.test(key) ? q.eq('id', key) : q.eq('slug', key)).maybeSingle();
  if (!data) return null;
  const config = cleanBooth(data);
  const overlays = await overlaysByIds(svc, config.overlay_ids);
  const frame: BoothFrame = { image: (data.frame_image as string) || '', spec: data.frame_design ? cleanFrameSpec(data.frame_design) : null };
  return { booth: { id: data.id as string, slug: data.slug as string, name: data.name as string }, config: { ...config, overlay_ids: overlays.map((o) => o.id) }, overlays, frame };
}

/** The overlays with these ids, in the order given (an id that no longer exists is skipped). */
export async function overlaysByIds(svc: SupabaseClient, ids: string[]): Promise<Overlay[]> {
  if (!ids.length) return [];
  const { data } = await svc.from('photobooth_overlays').select(OVERLAY_COLUMNS).in('id', ids);
  const byId = new Map(((data ?? []) as Overlay[]).map((o) => [o.id, o]));
  return ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
}

/** The path inside a bucket of one of our public addresses, or null when the address is not that bucket's. */
export function pathInBucket(url: string, bucket: string): string | null {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const i = url.indexOf(marker);
  return i < 0 ? null : decodeURIComponent(url.slice(i + marker.length));
}

// A WebP file starts with "RIFF", four size bytes, then "WEBP"; a JPEG with FF D8 FF.
export const isWebp = (b: Uint8Array) => b.length > 12 && String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP';
export const isJpeg = (b: Uint8Array) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;

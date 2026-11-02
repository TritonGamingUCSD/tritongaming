import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { hasCapability, withGrantedCapabilities } from '@/lib/portal/capabilities';
import { loadGrantedCapabilities } from '@/lib/portal/grantedCapabilities';
import {
  MAX_LOOKS_PER_BOOTH,
  MAX_STICKERS_PER_LOOK,
  cleanBooth,
  cleanFrameSpec,
  splitConfig,
  type BoothSettings,
  type FrameSpec,
  type LookStyle,
  type Overlay,
} from '@/lib/photobooth/booth';

export const UUID = /^[0-9a-f-]{36}$/i;
export const OVERLAY_BUCKET = 'photobooth-overlays';
export const PHOTO_BUCKET = 'photobooth';
export const MAX_OVERLAY_BYTES = 600 * 1024; // the bucket refuses anything over 614400 bytes too
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
export const OVERLAY_COLUMNS = 'id, name, kind, image, placements';
export const BOOTH_COLUMNS = 'id, slug, name, gallery_token, countdown, accent, screen_bg, screen_ink, welcome_title, welcome_text, prompts, sounds, flash, qr_seconds';

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
  /** The address word of the booth's public gallery (/gallery/<this>). */
  gallery_token: string;
}

/** Words that are other addresses under /portal/photobooth, so a booth cannot take them as its own. */
export const RESERVED_SLUGS = ['booths', 'new'];

/** A look's frame. */
export interface BoothFrame {
  /** The public address of the frame picture, or '' for none. */
  image: string;
  /** What it is made of, or null when there is no frame designed. */
  spec: FrameSpec | null;
}

/** One look of a booth: its name, its colours and words, its frame and its stickers. */
export interface Look {
  id: string;
  name: string;
  style: LookStyle;
  frame: BoothFrame;
  overlays: Overlay[];
}

const LOOK_COLUMNS = 'id, booth_id, name, position, frame_image, frame_design, layout, aspect, strip_bg, text_color, footer, filter';

function toLook(row: Record<string, unknown>, overlays: Overlay[]): Look {
  const style = splitConfig(cleanBooth(row)).style;
  return {
    id: row.id as string,
    name: row.name as string,
    style,
    frame: { image: (row.frame_image as string) || '', spec: row.frame_design ? cleanFrameSpec(row.frame_design) : null },
    overlays,
  };
}

/** A booth with its settings (what the booth itself keeps) and its looks, by its address word (or id). */
export async function loadBooth(svc: SupabaseClient, key: string): Promise<{ booth: BoothInfo; config: BoothSettings; looks: Look[] } | null> {
  const q = svc.from('photobooths').select(BOOTH_COLUMNS);
  const { data } = await (UUID.test(key) ? q.eq('id', key) : q.eq('slug', key)).maybeSingle();
  if (!data) return null;
  const config = splitConfig(cleanBooth(data)).settings;
  const { data: rows } = await svc.from('photobooth_looks').select(LOOK_COLUMNS).eq('booth_id', data.id).order('position').order('created_at').limit(MAX_LOOKS_PER_BOOTH);
  const { data: stickers } = await svc
    .from('photobooth_overlays')
    .select(`${OVERLAY_COLUMNS}, look_id`)
    .in(
      'look_id',
      (rows ?? []).map((r) => r.id as string),
    )
    .order('position')
    .order('created_at')
    .limit(MAX_STICKERS_PER_LOOK * MAX_LOOKS_PER_BOOTH);
  const looks = (rows ?? []).map((r) =>
    toLook(
      r,
      ((stickers ?? []) as unknown as (Overlay & { look_id: string })[]).filter((o) => o.look_id === r.id).map(({ look_id: _l, ...o }) => o),
    ),
  );
  return { booth: { id: data.id as string, slug: data.slug as string, name: data.name as string, gallery_token: data.gallery_token as string }, config, looks };
}

/** The first look of each of the given booths, with its stickers (for the cards on the booths page). */
export async function firstLooks(svc: SupabaseClient, boothIds: string[]): Promise<Map<string, Look>> {
  const out = new Map<string, Look>();
  if (!boothIds.length) return out;
  const { data: rows } = await svc.from('photobooth_looks').select(LOOK_COLUMNS).in('booth_id', boothIds).order('position').order('created_at').limit(2000);
  const first = new Map<string, Record<string, unknown>>();
  for (const r of rows ?? []) if (!first.has(r.booth_id as string)) first.set(r.booth_id as string, r);
  const { data: stickers } = await svc
    .from('photobooth_overlays')
    .select(`${OVERLAY_COLUMNS}, look_id`)
    .in(
      'look_id',
      [...first.values()].map((r) => r.id as string),
    )
    .order('position')
    .order('created_at')
    .limit(MAX_STICKERS_PER_LOOK * Math.max(1, first.size));
  for (const [boothId, r] of first)
    out.set(
      boothId,
      toLook(
        r,
        ((stickers ?? []) as unknown as (Overlay & { look_id: string })[]).filter((o) => o.look_id === r.id).map(({ look_id: _l, ...o }) => o),
      ),
    );
  return out;
}

/** One look by its id, with the booth it belongs to. */
export async function loadLook(svc: SupabaseClient, lookId: string): Promise<{ look: Look; booth: BoothInfo; boothId: string } | null> {
  if (!UUID.test(lookId)) return null;
  const { data: row } = await svc.from('photobooth_looks').select(LOOK_COLUMNS).eq('id', lookId).maybeSingle();
  if (!row) return null;
  const { data: b } = await svc.from('photobooths').select('id, slug, name, gallery_token').eq('id', row.booth_id).maybeSingle();
  if (!b) return null;
  const overlays = await lookStickers(svc, lookId);
  return {
    look: toLook(row, overlays),
    booth: { id: b.id as string, slug: b.slug as string, name: b.name as string, gallery_token: b.gallery_token as string },
    boothId: b.id as string,
  };
}

/** The stickers a look has, in the order they were arranged. */
export async function lookStickers(svc: SupabaseClient, lookId: string): Promise<Overlay[]> {
  const { data } = await svc.from('photobooth_overlays').select(OVERLAY_COLUMNS).eq('look_id', lookId).order('position').order('created_at').limit(MAX_STICKERS_PER_LOOK);
  return (data ?? []) as Overlay[];
}

/** Deletes picture files of stickers, frames and logos, except any that a sticker or a look still uses (a copied look shares its pictures with the look it was copied from). */
export async function removeUnusedOverlayFiles(svc: SupabaseClient, urls: (string | null | undefined)[]): Promise<void> {
  const unique = [...new Set(urls.filter((u): u is string => !!u))];
  if (!unique.length) return;
  const [stickers, frames, logos] = await Promise.all([
    svc.from('photobooth_overlays').select('image').in('image', unique),
    svc.from('photobooth_looks').select('frame_image').in('frame_image', unique),
    svc.from('photobooth_looks').select('frame_design->>logoUrl').in('frame_design->>logoUrl', unique),
  ]);
  const used = new Set<string>([
    ...(stickers.data ?? []).map((r) => r.image as string),
    ...(frames.data ?? []).map((r) => r.frame_image as string),
    ...((logos.data ?? []) as unknown as Record<string, string>[]).map((r) => r.logoUrl),
  ]);
  const paths = unique.flatMap((u) => {
    const p = used.has(u) ? null : pathInBucket(u, OVERLAY_BUCKET);
    return p ? [p] : [];
  });
  if (paths.length) await svc.storage.from(OVERLAY_BUCKET).remove(paths);
}

/** The path inside a bucket of one of our public addresses, or null when the address is not that bucket's. */
export function pathInBucket(url: string, bucket: string): string | null {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const i = url.indexOf(marker);
  return i < 0 ? null : decodeURIComponent(url.slice(i + marker.length));
}

// A WebP file starts with "RIFF", four size bytes, then "WEBP"; a JPEG with FF D8 FF.
export const isWebp = (b: Uint8Array) => b.length > 12 && String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP';
export const isGif = (b: Uint8Array) => b.length > 6 && String.fromCharCode(...b.slice(0, 4)) === 'GIF8';
export const isJpeg = (b: Uint8Array) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;

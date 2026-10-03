import { createClient } from '@/lib/supabase/client';

export const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB, pre-compression
const GIF_KEEP_BYTES = 1024 * 1024;

export interface UploadImageOptions {
  /** Longest edge to downscale to before upload. */
  maxDimension?: number;
  /**
   * 'square' center-crops to a 1:1 ratio, discarding whatever falls
   * outside it — only ever safe for content that's meant to fill a circle/
   * square with no meaningful margin (this codebase doesn't currently use
   * it for anything; avatars go through the manual interactiveCrop path
   * instead, which skips processImage entirely). 'pad' also produces a 1:1
   * ratio but by extending onto a transparent square canvas instead —
   * nothing from the original image is lost, which is what division logos
   * need (a logo exported without its own internal padding was getting
   * center-cropped right up to its own edge, reading as "cut off"). 'none'
   * keeps the original aspect ratio (flyers).
   */
  crop?: 'square' | 'pad' | 'none';
  /** WebP encode quality, 0-1. */
  quality?: number;
  /** Stored as "<pathPrefix>/<uuid>.<ext>" instead of "<uuid>.<ext>" — used to scope a bucket's RLS to per-user folders (e.g. avatars). */
  pathPrefix?: string;
}

// Downscales (and optionally crops or pads to square) via canvas, then
// re-encodes as WebP so uploads use meaningfully less storage than the
// original photo straight off a phone. Small GIFs are passed through untouched
// (redrawing one onto a canvas flattens it to its first frame and kills the
// animation); a GIF over GIF_KEEP_BYTES is flattened to a WebP instead, since
// a heavy animation costs far more than it is worth on a flyer or avatar.
// If re-encoding would make an already-small file bigger, the original is kept.
async function processImage(file: File, { maxDimension = 1600, crop = 'none', quality = 0.82 }: UploadImageOptions): Promise<{ blob: Blob; ext: string }> {
  if (file.type === 'image/gif' && file.size <= GIF_KEEP_BYTES) return { blob: file, ext: 'gif' };

  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return { blob: file, ext: file.name.split('.').pop() || 'jpg' };

  if (crop === 'pad') {
    // Canvas is a square sized to the LONGER edge — nothing gets cropped,
    // the shorter edge just gets transparent margin on both sides instead.
    const side = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, maxDimension / side);
    canvas.width = canvas.height = Math.max(1, Math.round(side * scale));
    const dw = Math.round(bitmap.width * scale);
    const dh = Math.round(bitmap.height * scale);
    ctx.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height, Math.round((canvas.width - dw) / 2), Math.round((canvas.height - dh) / 2), dw, dh);
  } else {
    // 'square': crop rect is centered on the SHORTER edge (discards the
    // excess). 'none': crop rect is the whole image (no crop at all).
    let sx = 0, sy = 0, sw = bitmap.width, sh = bitmap.height;
    if (crop === 'square') {
      sw = sh = Math.min(bitmap.width, bitmap.height);
      sx = (bitmap.width - sw) / 2;
      sy = (bitmap.height - sh) / 2;
    }
    const scale = Math.min(1, maxDimension / Math.max(sw, sh));
    canvas.width = Math.max(1, Math.round(sw * scale));
    canvas.height = Math.max(1, Math.round(sh * scale));
    ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Image compression failed'))), 'image/webp', quality);
  });
  // Already small and not shrunk by resizing: re-encoding would only make it bigger.
  const untouched = Math.max(bitmap.width, bitmap.height) <= maxDimension && crop === 'none';
  if (untouched && blob.size >= file.size && file.type !== 'image/gif' && ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    return { blob: file, ext: file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/png' ? 'png' : 'webp' };
  }
  return { blob, ext: 'webp' };
}

async function uploadBlob(bucket: string, blob: Blob, ext: string, pathPrefix?: string): Promise<string> {
  const supabase = createClient();
  const filename = `${crypto.randomUUID()}.${ext}`;
  const path = pathPrefix ? `${pathPrefix}/${filename}` : filename;

  const { error } = await supabase.storage.from(bucket).upload(path, blob, {
    cacheControl: '3600',
    contentType: blob.type,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadImageToStorage(bucket: string, file: File, options: UploadImageOptions = {}): Promise<string> {
  const { blob, ext } = await processImage(file, options);
  return uploadBlob(bucket, blob, ext, options.pathPrefix);
}

// For an image already cropped/encoded client-side (see AvatarCropModal) —
// skips the auto center-crop + resize in processImage since the caller
// already produced the exact pixels it wants uploaded.
export async function uploadCroppedImage(bucket: string, blob: Blob, pathPrefix?: string): Promise<string> {
  return uploadBlob(bucket, blob, 'webp', pathPrefix);
}

const STORAGE_URL_MARKER = '/storage/v1/object/public/';

// Pure string parsing, safe to import from both client components and
// server-side routes (e.g. the admin storage-cleanup sweep) — reverses
// getPublicUrl() back into the {bucket, path} an object was uploaded under.
// Returns null for anything that isn't one of our own Storage URLs (an
// external flyer link a division's logo_url still holds from before this
// upload system existed, for instance).
export function parseStorageUrl(url: string): { bucket: string; path: string } | null {
  const idx = url.indexOf(STORAGE_URL_MARKER);
  if (idx === -1) return null;
  const rest = url.slice(idx + STORAGE_URL_MARKER.length);
  const slash = rest.indexOf('/');
  if (slash === -1) return null;
  return { bucket: rest.slice(0, slash), path: decodeURIComponent(rest.slice(slash + 1)) };
}

// Best-effort — a failed delete (already gone, a permissions edge case,
// a transient network error) never throws, since it runs after the DB save
// that actually matters has already succeeded.
export async function deleteStorageUrl(url: string | null | undefined): Promise<void> {
  if (!url) return;
  const parsed = parseStorageUrl(url);
  if (!parsed) return;
  const supabase = createClient();
  try {
    await supabase.storage.from(parsed.bucket).remove([parsed.path]);
  } catch {
    // ignore — see above
  }
}

// Call after a save succeeds with oldUrl replaced by newUrl (or cleared) —
// no-ops when nothing actually changed, so re-saving a form without
// touching its image never deletes the image it's still using.
export async function deleteIfReplaced(oldUrl: string | null | undefined, newUrl: string | null | undefined): Promise<void> {
  if (!oldUrl || oldUrl === newUrl) return;
  await deleteStorageUrl(oldUrl);
}

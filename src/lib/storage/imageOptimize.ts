import sharp from 'sharp';

// Longest edge each bucket needs for how its pictures are shown. Nothing is ever enlarged.
export const MAX_EDGE: Record<string, number> = { avatars: 512, 'division-logos': 600, 'event-flyers': 1600, 'doc-attachments': 2400, 'site-content': 2000, 'help-attachments': 1800, 'custom-emojis': 128 };
const DEFAULT_EDGE = 2000;
// Files this small are left alone (re-encoding them only loses quality), and a rewrite has to save at least 10%.
const SKIP_UNDER_BYTES = 120 * 1024;
const MIN_SAVING = 0.1;

// Re-encode a stored picture in the SAME format, so its address and every place that uses it keep working.
// JPEG: high-quality mozjpeg. PNG: lossless (transparency and sharp edges untouched). WebP: quality 82.
// Returns null when there is nothing worth saving. Animated files (GIF, animated WebP) are never touched.
export async function optimizeImage(bucket: string, bytes: Buffer): Promise<{ bytes: Buffer; mime: string } | null> {
  if (bytes.length < SKIP_UNDER_BYTES) return null;
  const meta = await sharp(bytes, { limitInputPixels: 80_000_000 }).metadata();
  // Go by what the bytes really are, not the file name (a few older files have a .webp name but PNG content).
  const mime = meta.format === 'jpeg' ? 'image/jpeg' : meta.format === 'png' ? 'image/png' : meta.format === 'webp' ? 'image/webp' : '';
  if (!mime || (meta.pages ?? 1) > 1) return null;
  const edge = MAX_EDGE[bucket] ?? DEFAULT_EDGE;
  let img = sharp(bytes, { limitInputPixels: 80_000_000 }).rotate().resize(edge, edge, { fit: 'inside', withoutEnlargement: true });
  if (mime === 'image/jpeg') img = img.jpeg({ quality: 82, mozjpeg: true });
  else if (mime === 'image/png') img = img.png({ compressionLevel: 9, effort: 10 });
  else img = img.webp({ quality: 82, effort: 5 });
  const out = await img.toBuffer();
  return out.length <= bytes.length * (1 - MIN_SAVING) ? { bytes: out, mime } : null;
}

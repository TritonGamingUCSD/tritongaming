import type { SupabaseClient } from '@supabase/supabase-js';
import { PHOTO_BUCKET } from '@/lib/photobooth/server';
import { listAllObjects } from '@/lib/storage/storageBuckets';

// Deletes the finished pictures that have expired (their file and their row). Run by the daily job; safe to run as often as you like. Returns how many were removed. If the files cannot be removed the rows are kept, so the next run tries again
// (deleting the row first would leave a file nothing points to).
export async function cleanupPhotos(svc: SupabaseClient, now: Date = new Date()): Promise<{ removed: number }> {
  const { data } = await svc.from('photobooth_photos').select('id, path, gif_path').lte('expires_at', now.toISOString()).limit(500);
  const rows = (data ?? []) as { id: string; path: string; gif_path: string | null }[];
  if (!rows.length) return { removed: 0 };
  const { error } = await svc.storage.from(PHOTO_BUCKET).remove(rows.flatMap((r) => (r.gif_path ? [r.path, r.gif_path] : [r.path])));
  if (error) {
    console.warn('[photobooth] could not remove expired picture files; will try again next run:', error.message);
    return { removed: 0 };
  }
  await svc
    .from('photobooth_photos')
    .delete()
    .in(
      'id',
      rows.map((r) => r.id),
    );
  return { removed: rows.length };
}

const DAY_MS = 24 * 60 * 60 * 1000;

// The weekly safety net for the pictures bucket: a file that no picture row points to (a booth deleted with more pictures than it could list, an interrupted upload, a removal that failed) is deleted once it is a day old. The rows keep bare paths,
// not addresses, so the general storage tidy-up cannot judge this bucket; this does it by comparing with the rows.
export async function sweepOrphanPhotos(svc: SupabaseClient, now: Date = new Date()): Promise<{ orphans: number }> {
  const known = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await svc
      .from('photobooth_photos')
      .select('path, gif_path')
      .range(from, from + 999);
    if (error) throw new Error('Could not read which pictures are in use, so nothing was deleted.');
    for (const r of data ?? []) {
      known.add(r.path as string);
      if (r.gif_path) known.add(r.gif_path as string);
    }
    if ((data ?? []).length < 1000) break;
  }
  const cutoff = now.getTime() - DAY_MS;
  const orphans = (await listAllObjects(svc, PHOTO_BUCKET)).filter((o) => !known.has(o.path) && o.createdAt > 0 && o.createdAt < cutoff).map((o) => o.path);
  for (let i = 0; i < orphans.length; i += 100) {
    const { error } = await svc.storage.from(PHOTO_BUCKET).remove(orphans.slice(i, i + 100));
    if (error) console.warn('[photobooth] could not remove stray picture files:', error.message);
  }
  return { orphans: orphans.length };
}

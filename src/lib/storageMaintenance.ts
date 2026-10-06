import type { SupabaseClient } from '@supabase/supabase-js';
import { MANAGED_BUCKETS, listAllObjects } from '@/lib/storageBuckets';
import { optimizeImage } from '@/lib/imageOptimize';

// Keeps file storage tidy without anyone pressing a button (see /api/cron/storage-maintenance):
//   • a file that nothing points to any more is deleted, but only once it is a day old, so a picture that was just uploaded into a
//     form that has not been saved yet is never taken away;
//   • every stored picture is re-saved smaller in place (same address and format, so no link changes).
// New uploads are already compressed in the browser; this catches anything older or anything that slipped through.
const MIN_AGE_MS = 24 * 60 * 60 * 1000;
const IMAGE_EXT = /\.(jpe?g|png|webp)$/i;

export interface MaintenanceResult { deletedFiles: number; deletedBytes: number; compressedFiles: number; savedBytes: number; failed: number }

// Buckets the tidy-up deletes from. What is "in use" comes from storage_referenced_paths(), which reads every text/jsonb column in
// the database, so anything a page, event theme, doc or profile still links to is kept.
export const SWEPT_BUCKETS = MANAGED_BUCKETS.map((b) => b.bucket);

export async function findUnused(svc: SupabaseClient, minAgeMs = MIN_AGE_MS): Promise<{ bucket: string; path: string; size: number }[]> {
  const { data, error } = await svc.rpc('storage_referenced_paths');
  if (error || !Array.isArray(data)) throw new Error('Could not read which files are in use, so nothing was deleted.');
  const referenced = new Set<string>((data as string[]).map((p) => { try { return decodeURIComponent(p); } catch { return p; } }));
  const cutoff = Date.now() - minAgeMs;
  const out: { bucket: string; path: string; size: number }[] = [];
  for (const bucket of SWEPT_BUCKETS) {
    for (const o of await listAllObjects(svc, bucket)) {
      if (!referenced.has(`${bucket}/${o.path}`) && o.createdAt > 0 && o.createdAt < cutoff) out.push({ bucket, path: o.path, size: o.size });
    }
  }
  return out;
}

export async function sweepUnused(svc: SupabaseClient): Promise<Pick<MaintenanceResult, 'deletedFiles' | 'deletedBytes' | 'failed'>> {
  const out = { deletedFiles: 0, deletedBytes: 0, failed: 0 };
  const unused = await findUnused(svc);
  for (const bucket of SWEPT_BUCKETS) {
    const mine = unused.filter((u) => u.bucket === bucket);
    if (mine.length === 0) continue;
    const { error } = await svc.storage.from(bucket).remove(mine.map((u) => u.path));
    if (error) out.failed += mine.length;
    else { out.deletedFiles += mine.length; out.deletedBytes += mine.reduce((n, u) => n + u.size, 0); }
  }
  return out;
}

export async function compressStored(svc: SupabaseClient): Promise<Pick<MaintenanceResult, 'compressedFiles' | 'savedBytes' | 'failed'>> {
  const out = { compressedFiles: 0, savedBytes: 0, failed: 0 };
  const { data: buckets } = await svc.storage.listBuckets();
  for (const { id: bucket } of buckets ?? []) {
    for (const o of (await listAllObjects(svc, bucket)).filter((x) => IMAGE_EXT.test(x.path))) {
      try {
        const { data: blob, error } = await svc.storage.from(bucket).download(o.path);
        if (error || !blob) { out.failed++; continue; }
        const smaller = await optimizeImage(bucket, Buffer.from(await blob.arrayBuffer()));
        if (!smaller) continue;
        const { error: upErr } = await svc.storage.from(bucket).upload(o.path, smaller.bytes, { contentType: smaller.mime, upsert: true, cacheControl: '3600' });
        if (upErr) { out.failed++; continue; }
        out.compressedFiles++; out.savedBytes += o.size - smaller.bytes.length;
      } catch { out.failed++; }
    }
  }
  return out;
}

import type { SupabaseClient } from '@supabase/supabase-js';
import { PHOTO_BUCKET } from '@/lib/photobooth/server';

// Deletes the finished pictures that have expired (their file and their row). Run by the daily job; safe to run as often as you like. Returns how many were removed.
export async function cleanupPhotos(svc: SupabaseClient, now: Date = new Date()): Promise<{ removed: number }> {
  const { data } = await svc.from('photobooth_photos').select('id, path, gif_path').lte('expires_at', now.toISOString()).limit(500);
  const rows = (data ?? []) as { id: string; path: string; gif_path: string | null }[];
  if (!rows.length) return { removed: 0 };
  await svc.storage.from(PHOTO_BUCKET).remove(rows.flatMap((r) => (r.gif_path ? [r.path, r.gif_path] : [r.path])));
  await svc
    .from('photobooth_photos')
    .delete()
    .in(
      'id',
      rows.map((r) => r.id),
    );
  return { removed: rows.length };
}

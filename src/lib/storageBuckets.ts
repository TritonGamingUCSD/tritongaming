import type { SupabaseClient } from '@supabase/supabase-js';

// The buckets the direct-upload system writes to (event flyers, stickers and fonts, division logos, profile pictures, site content). Shared
// by the weekly storage tidy-up (which buckets to sweep) and the system-stats route (which buckets to total up).
export const MANAGED_BUCKETS: { bucket: string }[] = [
  { bucket: 'event-flyers' },
  { bucket: 'division-logos' },
  { bucket: 'avatars' },
  { bucket: 'site-content' },
];

export interface StorageObject {
  path: string;
  size: number;
  /** When the file was uploaded (ms since epoch), 0 when unknown. */
  createdAt: number;
}

// Recurses into subfolders (avatars are stored as "<user_id>/<file>") —
// Supabase Storage's list() only returns one level at a time, and a folder
// entry comes back with id: null instead of file metadata.
export async function listAllObjects(
  supabase: SupabaseClient,
  bucket: string,
  prefix = ''
): Promise<StorageObject[]> {
  const results: StorageObject[] = [];
  const limit = 1000;
  let offset = 0;

  for (;;) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit, offset });
    if (error || !data) break;

    for (const entry of data) {
      const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null) {
        results.push(...await listAllObjects(supabase, bucket, fullPath));
      } else {
        results.push({ path: fullPath, size: entry.metadata?.size ?? 0, createdAt: entry.created_at ? new Date(entry.created_at).getTime() : 0 });
      }
    }

    if (data.length < limit) break;
    offset += limit;
  }

  return results;
}

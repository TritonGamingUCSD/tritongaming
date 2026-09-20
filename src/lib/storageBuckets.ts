import type { SupabaseClient } from '@supabase/supabase-js';

// The three buckets the direct-upload system writes to (event flyers,
// division logos, profile pictures — see the storage migrations). Shared
// between the storage-cleanup route (which buckets to sweep for orphans)
// and the system-stats route (which buckets to total up for the Storage
// tab's usage panel) so the two never list a different set of buckets.
export const MANAGED_BUCKETS: { bucket: string; table: string; column: string }[] = [
  { bucket: 'event-flyers', table: 'events', column: 'flyer_url' },
  { bucket: 'division-logos', table: 'divisions', column: 'logo_url' },
  { bucket: 'avatars', table: 'profiles', column: 'custom_avatar_url' },
];

export interface StorageObject {
  path: string;
  size: number;
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
        results.push({ path: fullPath, size: entry.metadata?.size ?? 0 });
      }
    }

    if (data.length < limit) break;
    offset += limit;
  }

  return results;
}

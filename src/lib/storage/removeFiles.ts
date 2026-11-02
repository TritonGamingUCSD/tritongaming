import type { SupabaseClient } from '@supabase/supabase-js';
import { MANAGED_BUCKETS } from '@/lib/storage/storageBuckets';

// Takes a stored file out of Supabase Storage the moment what used it is deleted (a prize, a division, an event, a doc, an account), instead of waiting for the weekly tidy-up. The same safety as the tidy-up: a file is only removed when NO text
// or jsonb column in the database still points to it (`storage_referenced_paths()`), so a picture another record shares, or one an older doc version still shows, is kept. Run it AFTER the delete has succeeded. It never throws: a file that could
// not be removed is left for the weekly tidy-up.
const MARK = '/storage/v1/object/public/';
const ADDRESS = /https?:\/\/[^"\s)\\,]*\/storage\/v1\/object\/public\/[^"\s)\\,]+/g;
/** Only buckets whose rows keep the file's full public address are judged this way (the photobooth's pictures and the emojis keep bare paths and have their own removal). */
const REMOVABLE = new Set(MANAGED_BUCKETS.map((b) => b.bucket));

/** Every stored-file address found anywhere inside a value (a row, a jsonb document, some text). */
export function storageUrlsIn(value: unknown): string[] {
  return [...new Set(JSON.stringify(value ?? '').match(ADDRESS) ?? [])];
}

const decode = (p: string) => {
  try {
    return decodeURIComponent(p);
  } catch {
    return p;
  }
};

/** Our own stored files among `urls`, as bucket and path (anything else, such as an outside link, is ignored). */
function parse(urls: (string | null | undefined)[]): { bucket: string; path: string }[] {
  const out = new Map<string, { bucket: string; path: string }>();
  for (const u of urls) {
    const i = u ? u.indexOf(MARK) : -1;
    if (!u || i < 0) continue;
    const rest = u.slice(i + MARK.length).split(/[?#]/)[0];
    const slash = rest.indexOf('/');
    if (slash < 0) continue;
    const bucket = rest.slice(0, slash);
    const path = decode(rest.slice(slash + 1));
    if (REMOVABLE.has(bucket)) out.set(`${bucket}/${path}`, { bucket, path });
  }
  return [...out.values()];
}

/** Removes the files behind `urls` that nothing points to any more. Gives how many were removed. */
export async function removeUnreferencedFiles(svc: SupabaseClient, urls: (string | null | undefined)[]): Promise<number> {
  const wanted = parse(urls);
  if (!wanted.length) return 0;
  try {
    const { data, error } = await svc.rpc('storage_referenced_paths');
    if (error || !Array.isArray(data)) {
      console.warn('[storage] could not read which files are in use; left them for the weekly tidy-up:', error?.message);
      return 0;
    }
    const inUse = new Set((data as string[]).map(decode));
    let removed = 0;
    for (const bucket of new Set(wanted.map((w) => w.bucket))) {
      const paths = wanted.filter((w) => w.bucket === bucket && !inUse.has(`${bucket}/${w.path}`)).map((w) => w.path);
      if (!paths.length) continue;
      const { error: rmError } = await svc.storage.from(bucket).remove(paths);
      if (rmError) console.warn(`[storage] could not remove ${paths.length} file(s) from ${bucket}:`, rmError.message);
      else removed += paths.length;
    }
    return removed;
  } catch (e) {
    console.warn('[storage] removing files failed:', e);
    return 0;
  }
}

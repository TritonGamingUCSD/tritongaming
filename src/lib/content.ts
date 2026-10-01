import { unstable_cache } from 'next/cache';
import { createPublicClient } from '@/lib/supabase/public';

// Public page copy rarely changes, so it's cached for a few minutes and shared
// between visitors. Saving in the content editor calls revalidateTag
// ('site-content'), so edits still show up right away. The fetchers throw on a
// database error so a failure is never cached — the catch is outside the cache.
const REVALIDATE_SECONDS = 300;

async function fetchBlocks(keys: string[]): Promise<Record<string, Record<string, unknown>>> {
  const { data, error } = await createPublicClient().from('site_contents').select('key, content').in('key', keys);
  if (error) throw error;
  const result: Record<string, Record<string, unknown>> = {};
  data?.forEach((row) => { result[row.key] = row.content as Record<string, unknown>; });
  return result;
}

export async function getContentBlocks(keys: string[]): Promise<Record<string, Record<string, unknown>>> {
  const sorted = [...keys].sort();
  try {
    return await unstable_cache(() => fetchBlocks(sorted), ['site-content', ...sorted], { revalidate: REVALIDATE_SECONDS, tags: ['site-content'] })();
  } catch {
    return {};
  }
}

export async function getContentBlock(key: string): Promise<Record<string, unknown>> {
  return (await getContentBlocks([key]))[key] ?? {};
}

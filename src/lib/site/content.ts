import { unstable_cache } from 'next/cache';
import { createPublicClient } from '@/lib/supabase/public';
import { getPreviewDrafts } from '@/lib/site/contentPreviewStore';

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
  let saved: Record<string, Record<string, unknown>> = {};
  try {
    saved = await unstable_cache(() => fetchBlocks(sorted), ['site-content', ...sorted], { revalidate: REVALIDATE_SECONDS, tags: ['site-content'] })();
  } catch {
    saved = {};
  }
  // Only the editor's /preview ever has drafts: their unsaved edits replace the saved copy of that block.
  const drafts = getPreviewDrafts();
  if (!drafts) return saved;
  const merged = { ...saved };
  for (const k of keys) if (drafts[k]) merged[k] = drafts[k];
  return merged;
}

export async function getContentBlock(key: string): Promise<Record<string, unknown>> {
  return (await getContentBlocks([key]))[key] ?? {};
}

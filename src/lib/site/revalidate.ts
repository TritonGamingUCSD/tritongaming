import { revalidateTag } from 'next/cache';

// Public pages read from tagged caches (lib/content.ts, lib/events.ts,
// team/getBoardMembers.ts). Call this after something they show is edited so
// the change appears immediately rather than after the cache timeout.
export type CacheTag = 'site-content' | 'events' | 'board' | 'divisions';
export function invalidate(...tags: CacheTag[]) {
  for (const t of tags) revalidateTag(t, { expire: 0 });
}

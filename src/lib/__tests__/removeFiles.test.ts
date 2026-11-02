import { describe, expect, test, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { removeUnreferencedFiles, storageUrlsIn } from '@/lib/storage/removeFiles';

const BASE = 'https://x.supabase.co/storage/v1/object/public';

/** A stand-in for the service client: `inUse` is what storage_referenced_paths() answers, `removed` collects what was removed. */
function fake(inUse: string[], opts: { rpcFails?: boolean } = {}) {
  const removed: Record<string, string[]> = {};
  const svc = {
    rpc: vi.fn(async () => (opts.rpcFails ? { data: null, error: { message: 'no' } } : { data: inUse, error: null })),
    storage: {
      from: (bucket: string) => ({
        remove: vi.fn(async (paths: string[]) => {
          removed[bucket] = [...(removed[bucket] ?? []), ...paths];
          return { error: null };
        }),
      }),
    },
  } as unknown as SupabaseClient;
  return { svc, removed };
}

describe('storageUrlsIn', () => {
  test('finds every stored-file address inside a row, nested json and text', () => {
    const row = {
      id: 1,
      flyer_url: `${BASE}/event-flyers/a.webp`,
      theme: { art: [{ url: `${BASE}/event-flyers/b.png?v=2` }] },
      note: `see ${BASE}/site-content/c.woff2 and https://elsewhere.test/d.png`,
    };
    expect(storageUrlsIn(row).sort()).toEqual([`${BASE}/event-flyers/a.webp`, `${BASE}/event-flyers/b.png?v=2`, `${BASE}/site-content/c.woff2`].sort());
  });
  test('nothing to find is an empty list', () => {
    expect(storageUrlsIn(null)).toEqual([]);
    expect(storageUrlsIn({ a: 'plain' })).toEqual([]);
  });
});

describe('removeUnreferencedFiles', () => {
  test('removes a file nothing points to, in its own bucket', async () => {
    const { svc, removed } = fake([]);
    expect(await removeUnreferencedFiles(svc, [`${BASE}/prize-photos/p.webp`])).toBe(1);
    expect(removed['prize-photos']).toEqual(['p.webp']);
  });
  test('keeps a file another record still shows', async () => {
    const { svc, removed } = fake(['prize-photos/p.webp']);
    expect(await removeUnreferencedFiles(svc, [`${BASE}/prize-photos/p.webp`])).toBe(0);
    expect(removed).toEqual({});
  });
  test('reads an encoded path and ignores a query string', async () => {
    const { svc, removed } = fake([]);
    await removeUnreferencedFiles(svc, [`${BASE}/doc-attachments/a%20b/c.png?x=1`]);
    expect(removed['doc-attachments']).toEqual(['a b/c.png']);
  });
  test('leaves other people’s links and buckets that keep bare paths alone', async () => {
    const { svc, removed } = fake([]);
    expect(await removeUnreferencedFiles(svc, ['https://elsewhere.test/a.png', `${BASE}/photobooth/guest.jpg`, `${BASE}/custom-emojis/e.png`, null, undefined])).toBe(0);
    expect(removed).toEqual({});
  });
  test('when it cannot tell what is in use, it removes nothing', async () => {
    const { svc, removed } = fake([], { rpcFails: true });
    expect(await removeUnreferencedFiles(svc, [`${BASE}/prize-photos/p.webp`])).toBe(0);
    expect(removed).toEqual({});
  });
});

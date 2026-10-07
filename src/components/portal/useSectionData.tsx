'use client';

import { useCallback, useEffect, useState } from 'react';

// Loads the data of a heavy portal section the first time it is opened (see lib/portalSectionData.ts) and keeps it for a minute, so
// switching away and back is instant but never shows anything older than that. `scope` changes when the person or the "view as" role does.
const TTL_MS = 60_000;
const cache = new Map<string, { at: number; data: unknown }>();
const inflight = new Map<string, Promise<unknown>>();

async function fetchSection(id: string, key: string): Promise<unknown> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;
  const running = inflight.get(key);
  if (running) return running;
  const p = (async () => {
    const res = await fetch(`/api/portal/section/${id}`, { cache: 'no-store' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((json as { error?: string }).error || 'Couldn’t load that. Try again.');
    cache.set(key, { at: Date.now(), data: json });
    return json;
  })().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

export function useSectionData<T>(id: string, scope: string): { data: T | null; error: string; retry: () => void } {
  const key = `${scope}|${id}`;
  const [state, setState] = useState<{ key: string; data: T | null; error: string }>(() => {
    const hit = cache.get(key);
    return { key, data: hit && Date.now() - hit.at < TTL_MS ? (hit.data as T) : null, error: '' };
  });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    fetchSection(id, key).then((d) => { if (alive) setState({ key, data: d as T, error: '' }); }).catch((e: Error) => { if (alive) setState({ key, data: null, error: e.message }); });
    return () => { alive = false; };
  }, [id, key, attempt]);
  const retry = useCallback(() => { cache.delete(key); setState({ key, data: null, error: '' }); setAttempt((n) => n + 1); }, [key]);
  return state.key === key ? { data: state.data, error: state.error, retry } : { data: null, error: '', retry };
}

export function SectionLoading({ error, retry }: { error: string; retry: () => void }) {
  return (
    <div role="status" style={{ padding: '2rem 0.5rem', color: 'var(--pp-ink)', fontSize: '0.95rem' }}>
      {error ? (<>{error} <button type="button" onClick={retry} style={{ marginLeft: '0.5rem', font: 'inherit', textDecoration: 'underline', background: 'none', border: 0, color: 'var(--p-accent-text)', cursor: 'pointer' }}>Try again</button></>) : 'Loading…'}
    </div>
  );
}

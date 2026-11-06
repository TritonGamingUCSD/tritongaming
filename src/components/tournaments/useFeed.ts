'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { buildFeed } from '@/lib/tournaments/feed';

export type Feed = ReturnType<typeof buildFeed>;

// A tournament's feed, kept live for a public page or a stream overlay: reloaded when a match changes (Realtime, which works without signing in for public tournaments) and every few seconds as a safety net.
// It keeps showing the last good data if a refresh fails, so a stream never flashes an error.
export function useFeed(slug: string, token?: string | null, pollMs = 4000) {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [error, setError] = useState(false);
  const busy = useRef(false);
  const load = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const r = await fetch(`/api/tournaments/${encodeURIComponent(slug)}/feed${token ? `?token=${encodeURIComponent(token)}` : ''}`, { cache: 'no-store' });
      if (r.ok) {
        setFeed((await r.json()) as Feed);
        setError(false);
      } else setError(true);
    } catch {
      setError(true);
    } finally {
      busy.current = false;
    }
  }, [slug, token]);
  const id = feed?.tournament.id;
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), pollMs);
    const sb = createClient();
    const channel = id
      ? sb
          .channel(`feed-${id}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_matches', filter: `tournament_id=eq.${id}` }, () => void load())
          .subscribe()
      : null;
    return () => {
      window.clearInterval(timer);
      if (channel) void sb.removeChannel(channel);
    };
  }, [load, id, pollMs]);
  return { feed, error };
}

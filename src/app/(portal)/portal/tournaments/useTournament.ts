'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { call, type TData } from './types';

// One tournament, kept fresh: it reloads when the matches change (Realtime, for public tournaments) and every few seconds as a fallback (drafts are not broadcast), and right after your own changes.
export function useTournament(slug: string) {
  const [data, setData] = useState<TData | null>(null);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const load = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    const { ok, j } = await call<TData>('GET', `/api/tournaments/${encodeURIComponent(slug)}`);
    busy.current = false;
    if (ok && j.tournament) {
      setData(j as TData);
      setError('');
    } else setError(j.error || 'Could not load it.');
  }, [slug]);
  useEffect(() => {
    void load();
    const id = data?.tournament.id;
    const timer = window.setInterval(() => {
      if (!document.hidden) void load();
    }, 6000);
    const sb = createClient();
    const channel = id
      ? sb
          .channel(`tournament-${id}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_matches', filter: `tournament_id=eq.${id}` }, () => void load())
          .subscribe()
      : null;
    return () => {
      window.clearInterval(timer);
      if (channel) void sb.removeChannel(channel);
    };
    // the channel is made again once the id is known
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, data?.tournament.id]);
  return { data, error, reload: load };
}

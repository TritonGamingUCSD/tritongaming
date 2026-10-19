'use client';

import { useCallback, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

// Claps go straight from phone to screen over a Realtime broadcast (nothing is stored and no server call is made per tap, so a room full of people clapping costs
// nothing). A phone sends its taps in one small message at most every 700 ms, and the screen draws from the count. A message is only a count for show: it cannot
// do anything beyond animate the screen.
const SEND_EVERY = 700;
const MAX_PER_MESSAGE = 12;

/** A phone's side: `clap()` on each tap; returns nothing to read. */
export function useClapSender(meetingId: string, enabled = true): () => void {
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null);
  const pending = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (!enabled) return;
    const supabase = createClient();
    const channel = supabase.channel(`meeting-claps:${meetingId}`);
    channel.subscribe();
    channelRef.current = channel;
    return () => { clearTimeout(timer.current); timer.current = undefined; pending.current = 0; channelRef.current = null; void supabase.removeChannel(channel); };
  }, [meetingId, enabled]);
  return useCallback(() => {
    pending.current = Math.min(MAX_PER_MESSAGE, pending.current + 1);
    if (timer.current) return;
    timer.current = setTimeout(() => {
      timer.current = undefined;
      const n = pending.current; pending.current = 0;
      if (n > 0) void channelRef.current?.send({ type: 'broadcast', event: 'clap', payload: { n } });
    }, SEND_EVERY);
  }, []);
}

/** The screen's side: `onClap(n)` for each message that arrives. */
export function useClapListener(meetingId: string | null | undefined, onClap: (n: number) => void, enabled = true) {
  const ref = useRef(onClap);
  ref.current = onClap;
  useEffect(() => {
    if (!meetingId || !enabled) return;
    const supabase = createClient();
    const channel = supabase.channel(`meeting-claps:${meetingId}`);
    channel.on('broadcast', { event: 'clap' }, ({ payload }) => {
      const n = Number(payload?.n);
      if (Number.isFinite(n) && n > 0 && !document.hidden) ref.current(Math.min(MAX_PER_MESSAGE, Math.floor(n)));
    }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [meetingId, enabled]);
}

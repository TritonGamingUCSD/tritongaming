'use client';

import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

// Calls `onChange` when the server says something changed in this meeting (see meetingLive.ts). Changes close together make one call, and calls are
// at least 2 seconds apart (a burst of reactions would otherwise refresh the screen non-stop). Nothing runs while the tab is hidden. Pair it with a slow `useVisiblePoll` as a backstop in case the connection is blocked.
export function useMeetingLive(meetingId: string | null | undefined, onChange: () => void, enabled = true) {
  const ref = useRef(onChange);
  ref.current = onChange;
  useEffect(() => {
    if (!meetingId || !enabled) return;
    const supabase = createClient();
    let pending: ReturnType<typeof setTimeout> | undefined;
    let last = 0;
    let joined = false;
    const channel = supabase.channel(`meeting-live:${meetingId}`);
    channel.on('broadcast', { event: 'changed' }, () => {
      if (pending) return;   // one is already on its way
      pending = setTimeout(() => { pending = undefined; last = Date.now(); if (!document.hidden) ref.current(); }, Math.max(400, 2000 - (Date.now() - last)));
    }).subscribe((status) => {
      if (status !== 'SUBSCRIBED') return;
      if (joined) ref.current();   // reconnected: catch up on anything missed
      joined = true;
    });
    return () => { clearTimeout(pending); void supabase.removeChannel(channel); };
  }, [meetingId, enabled]);
}

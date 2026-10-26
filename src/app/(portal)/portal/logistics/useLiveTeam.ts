'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { LiveEnvelope } from '@/lib/logistics/live';

// Working together on one page. Listens on the event's channel and the stock channel (the server announces every change on them; see lib/logistics/live.ts), and keeps a presence list
// of who has the page open and what number box each person is typing in. Messages from this very person are ignored (their own screen already shows what they did).
export interface Person { id: string; name: string; editing: string | null }

export function useLiveTeam({ me, planId, stockChannel, onChange }: { me: { id: string; name: string } | undefined; planId: string | null; stockChannel: string | null; onChange: (m: LiveEnvelope) => void }) {
  const [here, setHere] = useState<Person[]>([]);
  const [live, setLive] = useState(false);
  const handler = useRef(onChange);
  handler.current = onChange;
  const editing = useRef<string | null>(null);
  const presence = useRef<{ track: (p: Person) => Promise<unknown> } | null>(null);

  useEffect(() => {
    if (!me || (!planId && !stockChannel)) return;
    const sb = createClient();
    const channels = [planId ? `logi-${planId}` : null, stockChannel].filter((x): x is string => !!x).map((topic) => {
      const ch = sb.channel(topic, { config: { broadcast: { self: false } } });
      ch.on('broadcast', { event: 'change' }, (m) => { const e = m.payload as LiveEnvelope; if (e && e.uid !== me.id) handler.current(e); }).subscribe((status) => { if (status === 'SUBSCRIBED') setLive(true); });
      return ch;
    });
    const room = `logi-here-${planId ?? stockChannel}`;
    const pc = sb.channel(room, { config: { presence: { key: me.id } } });
    pc.on('presence', { event: 'sync' }, () => {
      const people = new Map<string, Person>();
      for (const list of Object.values(pc.presenceState() as Record<string, Person[]>)) for (const p of list) if (p?.id) people.set(p.id, { id: p.id, name: p.name, editing: p.editing ?? null });
      setHere([...people.values()]);
    }).subscribe((status) => { if (status === 'SUBSCRIBED') void pc.track({ id: me.id, name: me.name, editing: editing.current }); });
    presence.current = { track: (p) => pc.track(p) };
    return () => { presence.current = null; setLive(false); for (const ch of channels) void sb.removeChannel(ch); void sb.removeChannel(pc); };
  }, [me, planId, stockChannel]);

  // Called when a number box opens (key like "prize:<id>" or "line:<id>") and closes (null).
  const setEditing = useCallback((key: string | null) => {
    editing.current = key;
    if (me) void presence.current?.track({ id: me.id, name: me.name, editing: key });
  }, [me]);
  return { here: here.filter((p) => p.id !== me?.id), live, setEditing };
}

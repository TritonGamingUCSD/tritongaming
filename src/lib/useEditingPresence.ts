'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { usePortalIdentity } from '@/components/portal/PortalIdentity';

export interface Editor { id: string; name: string }

// Who else has the same thing open for editing right now (live, over Supabase presence). Pass a room such as `event:<id>`; null turns it off.
// Only mount it where someone is actually editing: being in the room means "I am editing this".
export function useEditingPresence(room: string | null): Editor[] {
  const me = usePortalIdentity();
  const [others, setOthers] = useState<Editor[]>([]);
  const meId = me?.id, meName = me?.name, track = me?.track;
  useEffect(() => {
    setOthers([]);
    if (!room || !meId || !track) return;
    const supabase = createClient();
    // One key per tab, so two tabs of the same person do not hide each other; people are de-duplicated by id below.
    const key = `${meId}:${Math.random().toString(36).slice(2, 8)}`;
    const channel = supabase.channel(`editing:${room}`, { config: { presence: { key } } });
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState() as Record<string, { id?: string; name?: string }[]>;
      const seen = new Map<string, Editor>();
      for (const metas of Object.values(state)) for (const m of metas) if (m.id && m.id !== meId && !seen.has(m.id)) seen.set(m.id, { id: m.id, name: m.name || 'Someone' });
      setOthers([...seen.values()].sort((a, b) => a.name.localeCompare(b.name)));
    }).subscribe(async (status) => { if (status === 'SUBSCRIBED') await channel.track({ id: meId, name: meName }); });
    return () => { void supabase.removeChannel(channel); };
  }, [room, meId, meName, track]);
  return others;
}

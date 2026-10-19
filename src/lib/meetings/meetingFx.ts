'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { FX_EVERY, FX_MAX, FX_MAX_STICKERS, type Fx } from './meetingFxPayload';

// Reactions and wall stickers go straight from the phone to the host's screen over one Realtime broadcast: nothing is sent to our server per tap, so there is no limit per person.
// A phone sends what it has collected at most every FX_EVERY ms, in one small message. The host screen draws it and counts the reactions (see useReactionLedger).
const channelName = (meetingId: string) => `meeting-fx:${meetingId}`;
const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/** A phone's side: `react(emoji)` and `sticker(emoji, x, y)` on each tap. */
export function useFxSender(meetingId: string, enabled = true) {
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null);
  const pending = useRef<{ r: Record<string, number>; s: { e: string; x: number; y: number }[] }>({ r: {}, s: [] });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (!enabled) return;
    const supabase = createClient();
    const channel = supabase.channel(channelName(meetingId));
    channel.subscribe();
    channelRef.current = channel;
    return () => { clearTimeout(timer.current); timer.current = undefined; pending.current = { r: {}, s: [] }; channelRef.current = null; void supabase.removeChannel(channel); };
  }, [meetingId, enabled]);
  const schedule = useCallback(() => {
    if (timer.current) return;
    timer.current = setTimeout(() => {
      timer.current = undefined;
      const { r, s } = pending.current; pending.current = { r: {}, s: [] };
      if (!Object.keys(r).length && !s.length) return;
      const msg: Fx = { b: newId(), ...(Object.keys(r).length ? { r } : {}), ...(s.length ? { s } : {}) };
      void channelRef.current?.send({ type: 'broadcast', event: 'fx', payload: msg });
    }, FX_EVERY);
  }, []);
  const react = useCallback((emoji: string) => {
    pending.current.r[emoji] = Math.min(FX_MAX, (pending.current.r[emoji] ?? 0) + 1);
    schedule();
  }, [schedule]);
  const sticker = useCallback((emoji: string, x: number, y: number) => {
    if (pending.current.s.length < FX_MAX_STICKERS) pending.current.s.push({ e: emoji, x, y });
    schedule();
  }, [schedule]);
  return { react, sticker };
}

/** The screen's side: `onFx(raw)` for each message that arrives (check it with `cleanFx`). */
export function useFxListener(meetingId: string | null | undefined, onFx: (raw: unknown) => void, enabled = true) {
  const ref = useRef(onFx);
  ref.current = onFx;
  useEffect(() => {
    if (!meetingId || !enabled) return;
    const supabase = createClient();
    const channel = supabase.channel(channelName(meetingId));
    channel.on('broadcast', { event: 'fx' }, ({ payload }) => { if (!document.hidden) ref.current(payload); }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [meetingId, enabled]);
}

type Batch = { b: string; r: Record<string, number> };

/** The host screen's count of reactions. Each message is kept until it has been saved (in one batched request every 10 s, and when the page is hidden or closed), and kept in
 *  this browser too, so closing the screen before a save never loses them: the next time it opens they are sent. The server counts each message id once, so two screens that both
 *  heard a message (or a resend) never count it twice. `unsaved` is what the saved totals do not include yet; show saved + unsaved. */
export function useReactionLedger(meetingId: string, onSaved: () => void, enabled = true) {
  const key = `tg-fx:${meetingId}`;
  const batches = useRef<Batch[]>([]);
  const saving = useRef(false);
  const [unsaved, setUnsaved] = useState<Record<string, number>>({});
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;

  const publish = useCallback(() => {
    const t: Record<string, number> = {};
    for (const b of batches.current) for (const [e, n] of Object.entries(b.r)) t[e] = (t[e] ?? 0) + n;
    setUnsaved(t);
    try { if (batches.current.length) localStorage.setItem(key, JSON.stringify(batches.current)); else localStorage.removeItem(key); } catch { /* storage unavailable: counts are still sent every 10 s */ }
  }, [key]);

  const save = useCallback(async (leaving = false) => {
    if (saving.current || !batches.current.length) return;
    saving.current = true;
    const sent = batches.current.slice(0, leaving ? 300 : 2000);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/reactions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ batches: sent }), keepalive: leaving });
      if (res.ok) {
        const done = new Set(sent.map((b) => b.b));
        batches.current = batches.current.filter((b) => !done.has(b.b));
        publish(); onSavedRef.current();
      }
    } catch { /* tried again at the next save */ }
    saving.current = false;
  }, [meetingId, publish]);

  useEffect(() => {
    if (!enabled) return;
    try { const old = JSON.parse(localStorage.getItem(key) ?? '[]'); if (Array.isArray(old)) batches.current = old.filter((b) => b && typeof b.b === 'string' && b.r && typeof b.r === 'object'); } catch { /* none */ }
    publish(); void save();
    const timer = setInterval(() => { if (!document.hidden) void save(); }, 10_000);
    const leave = () => { if (document.hidden) void save(true); };
    const bye = () => void save(true);
    document.addEventListener('visibilitychange', leave);
    window.addEventListener('pagehide', bye);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', leave); window.removeEventListener('pagehide', bye); };
  }, [enabled, key, publish, save]);

  const add = useCallback((b: string, r: Record<string, number>) => {
    if (batches.current.some((x) => x.b === b)) return;
    batches.current.push({ b, r }); publish();
  }, [publish]);
  return { unsaved, add };
}

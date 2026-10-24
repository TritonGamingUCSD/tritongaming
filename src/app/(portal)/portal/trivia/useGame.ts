'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { LobbyPlayer, PublicState } from '@/lib/trivia/types';
import { call } from './api';

export interface MeState { status: 'in' | 'blocked' | 'removed'; score: number; userId: string; answered: number | null; answeredQ: number }
interface HostBits { images: string[]; players: LobbyPlayer[]; ready: number | null; perGame: number; quizSlug: string; blocks: boolean }

// Follows one game live. The server sends a small message on the game's channel whenever something changes, so a screen shows it within a fraction of a second without asking for anything; it also asks
// now and then (every 10 seconds, and when the phone wakes up) in case a message was missed. Both players (`/play`) and the host (`/games`) use it; the host also gets the lobby list.
const POLL_MS = 10000;

export function useGame(code: string, role: 'player' | 'host') {
  const [state, setState] = useState<PublicState | null>(null);
  const [me, setMe] = useState<MeState | null>(null);
  const [host, setHost] = useState<HostBits>({ images: [], players: [], ready: null, perGame: 10, quizSlug: '', blocks: true });
  const [error, setError] = useState('');
  const [gone, setGone] = useState(false);
  const offset = useRef(0);                   // the server's clock minus this device's
  const latest = useRef<PublicState | null>(null);
  const gameId = state?.gameId ?? null;
  const over = state?.status === 'done';

  const take = useCallback((s: PublicState) => {
    const cur = latest.current;
    if (cur && cur.gameId === s.gameId && s.now < cur.now) return;   // an older message that arrived late
    offset.current = s.now - Date.now();
    latest.current = s;
    setState(s);
  }, []);

  const load = useCallback(async () => {
    if (role === 'player') {
      const r = await call<{ state: PublicState; me: MeState }>('GET', `/api/trivia/play/${code}`);
      if (r.ok) { take(r.data.state); setMe(r.data.me); setError(''); }
      else if (r.status === 404) { setGone(true); setError(r.error); }
      else setError(r.error);
    } else {
      const r = await call<{ state: PublicState; images?: string[]; players: LobbyPlayer[]; ready: number | null; perGame: number; quizSlug: string; blocks: boolean }>('GET', `/api/trivia/games/${code}`);
      if (r.ok) { take(r.data.state); setHost((h) => ({ images: r.data.images ?? h.images, players: r.data.players, ready: r.data.ready ?? h.ready, perGame: r.data.perGame, quizSlug: r.data.quizSlug, blocks: r.data.blocks })); setError(''); }
      else if (r.status === 404) { setGone(true); setError(r.error); }
      else setError(r.error);
    }
  }, [code, role, take]);

  useEffect(() => { void load(); }, [load]);

  // The live channel.
  useEffect(() => {
    if (!gameId) return;
    const sb = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ch = sb.channel(`trivia:${gameId}`, { config: { broadcast: { self: false } } });
    ch.on('broadcast', { event: 'state' }, (m) => { take(m.payload as PublicState); })
      .on('broadcast', { event: 'gone' }, () => setGone(true))
      .subscribe((status) => { if (status === 'SUBSCRIBED') void load(); });   // anything that happened before the channel opened
    // The host also listens on its own channel for who joins and how many have answered. A short wait groups a burst of joins into one request; players get everything they need from the game channel.
    function later() { clearTimeout(timer); timer = setTimeout(() => void load(), 400); }
    const hostCh = role === 'host' ? sb.channel(`trivia-host:${gameId}`, { config: { broadcast: { self: false } } }) : null;
    hostCh?.on('broadcast', { event: 'players' }, (m) => { take(m.payload as PublicState); later(); })
      .on('broadcast', { event: 'count' }, (m) => {
        const p = m.payload as { answered: number; q: number };
        setState((s) => { if (!s || s.current !== p.q || s.status !== 'question') return s; const n = { ...s, answered: Math.max(s.answered ?? 0, p.answered) }; latest.current = n; return n; });
      })
      .subscribe();
    return () => { clearTimeout(timer); void sb.removeChannel(ch); if (hostCh) void sb.removeChannel(hostCh); };
  }, [gameId, load, take, role]);

  // The back-up: ask every few seconds and when the screen wakes up, until the game is over.
  useEffect(() => {
    if (!gameId || over) return;
    const id = setInterval(() => { if (document.visibilityState === 'visible') void load(); }, POLL_MS);
    const wake = () => { if (document.visibilityState === 'visible') void load(); };
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('online', wake);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', wake); window.removeEventListener('online', wake); };
  }, [gameId, over, load]);

  const serverNow = useCallback(() => Date.now() + offset.current, []);
  return { state, me, host, error, gone, reload: load, serverNow, setMe, setState: take };
}

/** Milliseconds left until `endsAt` (the server's clock), refreshed about ten times a second. */
export function useCountdown(endsAt: number | null | undefined, serverNow: () => number): number {
  const [left, setLeft] = useState(() => (endsAt ? Math.max(0, endsAt - serverNow()) : 0));
  useEffect(() => {
    if (!endsAt) { setLeft(0); return; }
    const tick = () => setLeft(Math.max(0, endsAt - serverNow()));
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [endsAt, serverNow]);
  return left;
}

/** Keeps the screen on while a game is open (a phone that dims in the middle of a question loses the tap), where the browser allows it. */
export function useWakeLock() {
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    let alive = true;
    const ask = async () => {
      try { const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }; if (nav.wakeLock && document.visibilityState === 'visible') { const l = await nav.wakeLock.request('screen'); if (alive) lock = l; else void l.release(); } } catch { /* not allowed: the phone may dim, nothing else */ }
    };
    void ask();
    document.addEventListener('visibilitychange', ask);   // the lock is dropped when the page is hidden, so take it again when it is back
    return () => { alive = false; document.removeEventListener('visibilitychange', ask); void lock?.release().catch(() => {}); };
  }, []);
}

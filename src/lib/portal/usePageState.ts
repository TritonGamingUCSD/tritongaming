'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { useLiveParams, usePortalParams } from '@/lib/portal/usePortalParams';

// Page state that survives a refresh, a reload and a shared link, handled in ONE place. A screen does not write its own address code, its own storage code or its own refresh handling: it asks for a piece of state here.
//   useAddressState  a view choice that belongs in the ADDRESS (a sort, a filter, a grouping, full screen): the same link opens the same view
//   useSessionState  something only this tab needs back (rows opened, a draft): kept for the tab
//   useKeptScroll    where a scrolling box was scrolled to
// The portal's own refresh (PortalHub) saves and restores the address and the page's scroll, so all three come back after it.

export interface Codec<T> { parse: (raw: string | null) => T; format: (v: T) => string | null }   // format returning null leaves the value out of the address
export const textCodec: Codec<string> = { parse: (r) => r ?? '', format: (v) => v || null };
export const flagCodec: Codec<boolean> = { parse: (r) => r === '1', format: (v) => (v ? '1' : null) };
/** One of a fixed list of words; anything else (an old link) falls back to the first. */
export const wordCodec = <T extends string>(words: readonly T[], fallback: T): Codec<T> => ({ parse: (r) => (words.find((w) => w === r) ?? fallback), format: (v) => (v === fallback ? null : v) });

export function useAddressState<T>(key: string, codec: Codec<T>): [T, (v: T | ((cur: T) => T)) => void] {
  const live = useLiveParams(), setParams = usePortalParams();
  const [value, setValue] = useState<T>(() => codec.parse(live.get(key)));
  const codecRef = useRef(codec);
  codecRef.current = codec;
  const set = useCallback((v: T | ((cur: T) => T)) => {
    setValue((cur) => { const next = typeof v === 'function' ? (v as (c: T) => T)(cur) : v; setParams({ [key]: codecRef.current.format(next) }); return next; });
  }, [key, setParams]);
  return [value, set];
}

export function useSessionState<T>(key: string, initial: T): [T, (v: T | ((cur: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => { try { const raw = sessionStorage.getItem(key); return raw === null ? initial : (JSON.parse(raw) as T); } catch { return initial; } });
  const set = useCallback((v: T | ((cur: T) => T)) => {
    setValue((cur) => { const next = typeof v === 'function' ? (v as (c: T) => T)(cur) : v; try { sessionStorage.setItem(key, JSON.stringify(next)); } catch { /* not remembered */ } return next; });
  }, [key]);
  return [value, set];
}

// A scrolling box keeps its place: saved as it scrolls (throttled), put back once `ready` (its rows are there) and again whenever `again` changes (the box was drawn anew).
export function useKeptScroll(ref: RefObject<HTMLElement | null>, key: string, ready: boolean, again?: unknown): () => void {
  const done = useRef(false);
  useEffect(() => { done.current = false; }, [again]);
  useEffect(() => {
    if (done.current || !ready || !ref.current) return;
    done.current = true;
    try { const j = JSON.parse(sessionStorage.getItem(key) ?? 'null'); if (j) window.requestAnimationFrame(() => { ref.current?.scrollTo(j.x ?? 0, j.y ?? 0); }); } catch { /* none */ }
  }, [ref, key, ready, again]);
  const last = useRef(0);
  return () => {
    const now = Date.now();
    if (now - last.current < 200) return;
    last.current = now;
    try { sessionStorage.setItem(key, JSON.stringify({ x: ref.current?.scrollLeft ?? 0, y: ref.current?.scrollTop ?? 0 })); } catch { /* not remembered */ }
  };
}

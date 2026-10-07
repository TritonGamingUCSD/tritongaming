'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

// Autosaves a form's work in this browser so a closed tab, a reload or a lost connection does not lose it. When the form is opened again it
// offers to continue. Drafts are kept per person and per form, and expire after 30 days. Nothing is stored for an empty form.
const PREFIX = 'tg_draft:';
export const DRAFT_TTL_MS = 30 * 86_400_000;

interface Stored<T> { v: T; at: number }

function sweepExpired() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (!k?.startsWith(PREFIX)) continue;
      try { const d = JSON.parse(localStorage.getItem(k) ?? 'null') as Stored<unknown> | null; if (!d || Date.now() - d.at > DRAFT_TTL_MS) localStorage.removeItem(k); } catch { localStorage.removeItem(k); }
    }
  } catch { /* storage blocked */ }
}

/**
 * name: which form ("event-new"); value: everything typed so far; isEmpty: true when nothing worth keeping has been typed.
 * Returns the saved draft to offer (if any), and functions to take it, drop it, or clear it after a successful save.
 */
export function useDraft<T>(name: string, value: T, isEmpty: (v: T) => boolean) {
  const [scope, setScope] = useState<string | null>(null);
  const [offer, setOffer] = useState<Stored<T> | null>(null);
  const [ready, setReady] = useState(false);
  const isEmptyRef = useRef(isEmpty); isEmptyRef.current = isEmpty;

  useEffect(() => {
    let cancelled = false;
    createClient().auth.getUser().then(({ data }) => { if (!cancelled) setScope(data.user?.id ?? 'anon'); }).catch(() => { if (!cancelled) setScope('anon'); });
    return () => { cancelled = true; };
  }, []);
  const key = scope ? `${PREFIX}${scope}:${name}` : null;

  useEffect(() => {
    if (!key) return;
    sweepExpired();
    try {
      const d = JSON.parse(localStorage.getItem(key) ?? 'null') as Stored<T> | null;
      if (d && Date.now() - d.at < DRAFT_TTL_MS && !isEmptyRef.current(d.v)) setOffer(d); else if (d) localStorage.removeItem(key);
    } catch { /* unreadable: ignore */ }
    setReady(true);
  }, [key]);

  // Save a moment after the last change. While an old draft is waiting to be answered, the new typing does not overwrite it.
  useEffect(() => {
    if (!key || !ready || offer) return;
    const t = setTimeout(() => {
      try {
        if (isEmptyRef.current(value)) localStorage.removeItem(key);
        else localStorage.setItem(key, JSON.stringify({ v: value, at: Date.now() } satisfies Stored<T>));
      } catch { /* storage full or blocked: the form still works */ }
    }, 800);
    return () => clearTimeout(t);
  }, [key, value, ready, offer]);

  const clear = useCallback(() => { setOffer(null); if (key) try { localStorage.removeItem(key); } catch { /* ignore */ } }, [key]);
  const accept = useCallback((): T | null => { const o = offer; setOffer(null); return o ? o.v : null; }, [offer]);
  return { offer, accept, discard: clear, clear };
}

export function draftAge(at: number): string {
  const mins = Math.round((Date.now() - at) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

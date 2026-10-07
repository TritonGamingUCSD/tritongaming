'use client';

import { useEffect, useRef } from 'react';

// Runs `fn` every `ms` while the tab is visible, and once more as soon as the tab comes back (so nothing is stale on return).
// A hidden tab sends no requests at all, which is most of what an open-but-forgotten portal tab would otherwise cost.
// `fn` is read through a ref, so passing a new function each render does not restart the timer. Pass `enabled: false` to stop it.
export function useVisiblePoll(fn: () => void | Promise<unknown>, ms: number, enabled = true) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    const run = () => { void ref.current(); };
    const start = () => { if (!timer) timer = setInterval(run, ms); };
    const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
    const onVis = () => { if (document.visibilityState === 'visible') { run(); start(); } else stop(); };
    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVis);
    return () => { stop(); document.removeEventListener('visibilitychange', onVis); };
  }, [ms, enabled]);
}

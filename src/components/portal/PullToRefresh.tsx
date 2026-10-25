'use client';

import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { refreshPortal } from '@/lib/ui/refreshPortal';
import { confirmDiscardUnsaved, hasUnsavedChanges } from '@/lib/ui/useUnsavedChanges';
import styles from './PullToRefresh.module.css';

const TRIGGER = 64;          // how far (px, after the resistance) a pull has to go before letting go refreshes
const AWAY_MS = 90_000;      // coming back to the app after this long refreshes it by itself

// An app added to the home screen has no reload: this gives it the pull-down at the top of a page (only there; browsers have their own), and refreshes quietly when the app is opened again after a while
// (never while a form has unsaved changes). Both use the portal's refresh (lib/ui/refreshPortal.ts), which keeps the same page open.
export default function PullToRefresh() {
  const [pull, setPull] = useState(0);
  const state = useRef({ y0: 0, on: false, pull: 0 });

  useEffect(() => {
    let hiddenAt = 0;
    const onVis = () => {
      if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); return; }
      if (hiddenAt && Date.now() - hiddenAt > AWAY_MS && !hasUnsavedChanges()) refreshPortal();
      hiddenAt = 0;
    };
    document.addEventListener('visibilitychange', onVis);

    const standalone = (navigator as unknown as { standalone?: boolean }).standalone === true || window.matchMedia('(display-mode: standalone)').matches;
    const scrolledInside = (el: Element | null) => {   // a list or panel that is itself scrolled down: the pull belongs to it
      for (let n = el; n && n !== document.body; n = n.parentElement) {
        if (n.scrollTop > 0 && /(auto|scroll)/.test(getComputedStyle(n).overflowY)) return true;
      }
      return false;
    };
    const start = (e: TouchEvent) => {
      const t = e.target instanceof Element ? e.target : null;
      if (e.touches.length !== 1 || window.scrollY > 0 || !t || t.closest('[role=dialog],[role=alertdialog],input,textarea,select,[contenteditable],[data-no-pull]') || scrolledInside(t)) return;
      state.current = { y0: e.touches[0].clientY, on: true, pull: 0 };
    };
    const move = (e: TouchEvent) => {
      const s = state.current;
      if (!s.on) return;
      const dy = e.touches[0].clientY - s.y0;
      if (dy <= 0 || window.scrollY > 0) { s.pull = 0; setPull(0); return; }
      s.pull = Math.min(dy * 0.5, TRIGGER * 1.6);   // it resists
      setPull(s.pull);
    };
    const end = () => {
      const s = state.current;
      if (!s.on) return;
      s.on = false;
      const go = s.pull >= TRIGGER;
      s.pull = 0; setPull(0);
      if (go && confirmDiscardUnsaved()) refreshPortal();
    };
    if (standalone) {
      document.addEventListener('touchstart', start, { passive: true });
      document.addEventListener('touchmove', move, { passive: true });
      document.addEventListener('touchend', end, { passive: true });
      document.addEventListener('touchcancel', end, { passive: true });
    }
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      document.removeEventListener('touchstart', start); document.removeEventListener('touchmove', move);
      document.removeEventListener('touchend', end); document.removeEventListener('touchcancel', end);
    };
  }, []);

  if (pull <= 0) return null;
  return (
    <div className={styles.wrap} style={{ transform: `translate(-50%, ${pull - 44}px)` }} aria-hidden="true">
      <span className={`${styles.bubble} ${pull >= TRIGGER ? styles.ready : ''}`}><RefreshCw size={18} strokeWidth={2} style={{ transform: `rotate(${pull * 4}deg)` }} /></span>
    </div>
  );
}

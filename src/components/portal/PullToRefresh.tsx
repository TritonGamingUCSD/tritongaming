'use client';

import { useEffect, useRef } from 'react';
import { RefreshCw } from 'lucide-react';
import { refreshPortal, REFRESHED_EVENT } from '@/lib/ui/refreshPortal';
import { confirmDiscardUnsaved, hasUnsavedChanges } from '@/lib/ui/useUnsavedChanges';
import styles from './PullToRefresh.module.css';

const TRIGGER = 64;          // how far the bubble has to be pulled (px, after the resistance) before letting go refreshes
const MAX = 96;              // the furthest the bubble can ever travel: the pull gets heavier and heavier towards it
const HOLD = 56;             // where the bubble waits while the page refreshes
const MIN_SHOW_MS = 600;     // a refresh that answers at once still shows for this long, so it never just blinks
const GIVE_UP_MS = 8000;     // never spins for ever if the answer is lost
const AWAY_MS = 90_000;      // coming back to the app after this long refreshes it by itself

// The finger's distance becomes the bubble's: 1:1 at first, then heavier (rubber band), never past MAX.
const resist = (dy: number) => MAX * (1 - Math.exp(-dy / (MAX * 0.9)));

// An app added to the home screen has no reload: this gives it the pull-down at the top of a page (only there; browsers have their own), and refreshes quietly when the app is opened again after a while
// (never while a form has unsaved changes). Both use the portal's refresh (lib/ui/refreshPortal.ts), which keeps the same page open.
// The bubble follows the finger (a ring fills as you pull, it turns yellow and gives a tick when letting go would refresh), then waits and spins until the page has the new data, and slides away.
// The bubble is moved straight on the element (no re-render per touch move), so it keeps up with the finger.
export default function PullToRefresh() {
  const bubble = useRef<HTMLDivElement>(null);
  const live = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = bubble.current;
    if (!el) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let phase: 'idle' | 'pulling' | 'refreshing' = 'idle';
    let y0 = 0, x0 = 0, locked: 'v' | 'h' | null = null, pull = 0, armed = false, frame = 0, shownAt = 0, giveUp = 0, hideTimer = 0;
    let hiddenAt = 0;

    // One place that draws the bubble: how far down (px) and how full the ring is (0 to 1), plus whether it is being dragged (no easing) or settling (eased).
    const draw = (px: number, progress: number, drag: boolean) => {
      el.style.setProperty('--ptr-y', `${px}px`);
      el.style.setProperty('--ptr-p', String(Math.min(1, progress)));
      el.dataset.drag = drag ? '1' : '0';
    };
    const setState = (s: string) => { el.dataset.state = s; };
    const say = (t: string) => { if (live.current) live.current.textContent = t; };
    const rest = () => { phase = 'idle'; armed = false; pull = 0; setState('idle'); draw(-MAX / 2, 0, false); };

    const finish = () => {
      if (phase !== 'refreshing') return;
      window.clearTimeout(giveUp);
      const wait = Math.max(0, MIN_SHOW_MS - (Date.now() - shownAt));
      hideTimer = window.setTimeout(() => { setState('done'); draw(-MAX / 2, 1, false); say('Refreshed'); hideTimer = window.setTimeout(rest, 320); }, wait);
    };
    const beginRefresh = () => {
      phase = 'refreshing'; shownAt = Date.now(); setState('refreshing'); draw(HOLD, 1, false); say('Refreshing');
      giveUp = window.setTimeout(finish, GIVE_UP_MS);
      refreshPortal();
    };
    window.addEventListener(REFRESHED_EVENT, finish);

    const onVis = () => {
      if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); return; }
      if (hiddenAt && Date.now() - hiddenAt > AWAY_MS && !hasUnsavedChanges()) refreshPortal();
      hiddenAt = 0;
    };
    document.addEventListener('visibilitychange', onVis);

    const standalone = (navigator as unknown as { standalone?: boolean }).standalone === true || window.matchMedia('(display-mode: standalone)').matches;
    const scrolledInside = (node: Element | null) => {   // a list or panel that is itself scrolled down: the pull belongs to it
      for (let n = node; n && n !== document.body; n = n.parentElement) {
        if (n.scrollTop > 0 && /(auto|scroll)/.test(getComputedStyle(n).overflowY)) return true;
      }
      return false;
    };
    const start = (e: TouchEvent) => {
      const t = e.target instanceof Element ? e.target : null;
      if (phase === 'refreshing' || e.touches.length !== 1 || window.scrollY > 0 || !t || t.closest('[role=dialog],[role=alertdialog],input,textarea,select,[contenteditable],[data-no-pull]') || scrolledInside(t)) return;
      window.clearTimeout(hideTimer);
      y0 = e.touches[0].clientY; x0 = e.touches[0].clientX; locked = null; pull = 0; armed = false; phase = 'pulling';
    };
    const move = (e: TouchEvent) => {
      if (phase !== 'pulling') return;
      const dy = e.touches[0].clientY - y0, dx = e.touches[0].clientX - x0;
      if (!locked && (Math.abs(dy) > 8 || Math.abs(dx) > 8)) locked = Math.abs(dy) > Math.abs(dx) && dy > 0 ? 'v' : 'h';   // sideways swipes and upward scrolls are not a pull
      if (locked === 'h' || window.scrollY > 0) { rest(); return; }
      if (dy <= 0) { if (pull > 0) { pull = 0; cancelAnimationFrame(frame); frame = requestAnimationFrame(() => draw(-MAX / 2, 0, true)); } return; }
      if (e.cancelable) e.preventDefault();   // the page itself must not rubber-band under the bubble
      pull = resist(dy);
      if (el.dataset.state === 'idle' || el.dataset.state === 'done') setState('pulling');
      const nowArmed = pull >= TRIGGER;
      if (nowArmed !== armed) { armed = nowArmed; setState(armed ? 'armed' : 'pulling'); if (armed) navigator.vibrate?.(8); }
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => draw(pull - MAX / 2 + 8, pull / TRIGGER, true));
    };
    const end = () => {
      if (phase !== 'pulling') return;
      cancelAnimationFrame(frame);
      if (armed && confirmDiscardUnsaved()) beginRefresh();
      else rest();   // not far enough (or "keep my changes"): it springs back
    };
    if (standalone) {
      document.addEventListener('touchstart', start, { passive: true });
      document.addEventListener('touchmove', move, { passive: false });
      document.addEventListener('touchend', end, { passive: true });
      document.addEventListener('touchcancel', end, { passive: true });
    }
    rest();
    if (reduced) el.dataset.reduced = '1';
    return () => {
      window.clearTimeout(giveUp); window.clearTimeout(hideTimer); cancelAnimationFrame(frame);
      window.removeEventListener(REFRESHED_EVENT, finish);
      document.removeEventListener('visibilitychange', onVis);
      document.removeEventListener('touchstart', start); document.removeEventListener('touchmove', move);
      document.removeEventListener('touchend', end); document.removeEventListener('touchcancel', end);
    };
  }, []);

  return (
    <>
      <div ref={bubble} className={styles.wrap} data-state="idle" aria-hidden="true">
        <span className={styles.bubble}>
          <svg className={styles.ring} viewBox="0 0 40 40"><circle cx="20" cy="20" r="17" /></svg>
          <RefreshCw className={styles.icon} size={18} strokeWidth={2} />
        </span>
      </div>
      <span ref={live} className={styles.live} role="status" aria-live="polite" />
    </>
  );
}

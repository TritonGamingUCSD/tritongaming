'use client';

import { useEffect, useRef } from 'react';
import { RefreshCw } from 'lucide-react';
import { refreshPortal, REFRESHED_EVENT } from '@/lib/ui/refreshPortal';
import { confirmDiscardUnsaved, hasUnsavedChanges } from '@/lib/ui/useUnsavedChanges';
import styles from './PullToRefresh.module.css';

const TRIGGER = 64;          // how far the bubble has to be pulled (px, after the resistance) before letting go refreshes
const MAX = 96;              // the furthest the bubble can ever travel: the pull gets heavier and heavier towards it
const HOLD = 56;             // where the bubble waits while the page refreshes
const BUBBLE = 44;          // the bubble's height
const SETTLE_MS = 150;       // once the new data is in, a moment for the page to redraw before it slides back
const MIN_SHOW_MS = 600;     // a refresh that answers at once still shows for this long, so it never just blinks
const GIVE_UP_MS = 8000;     // never spins for ever if the answer is lost
const AWAY_MS = 90_000;      // coming back to the app after this long refreshes it by itself

// The finger's distance becomes the bubble's: 1:1 at first, then heavier (rubber band), never past MAX.
const resist = (dy: number) => MAX * (1 - Math.exp(-dy / (MAX * 0.9)));

// An app added to the home screen has no reload: this gives it the pull-down at the top of a page (only there; phone browsers have their own); on a desktop (any browser) the same happens by scrolling up once more at the top, and refreshes quietly when the app is opened again after a while
// (never while a form has unsaved changes). Both use the portal's refresh (lib/ui/refreshPortal.ts), which keeps the same page open.
// The whole page follows the finger down (like a phone's own lists), and a bubble in the gap above it fills a ring as you pull, turns yellow and ticks when letting go would refresh; then the page waits
// part-way down while the bubble spins until it has the new data, and slides back up. Both are moved straight on the elements (no re-render per touch move), so they keep up with the finger.
export default function PullToRefresh() {
  const bubble = useRef<HTMLDivElement>(null);
  const live = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = bubble.current;
    if (!el) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let phase: 'idle' | 'pulling' | 'refreshing' = 'idle';
    let y0 = 0, x0 = 0, locked: 'v' | 'h' | 'w' | null = null, pull = 0, armed = false, frame = 0, shownAt = 0, giveUp = 0, hideTimer = 0;
    let hiddenAt = 0;

    // One place that draws it all: how far the whole page is pulled down (px; the bubble sits in the gap that opens above it), how full the ring is (0 to 1), and whether the finger is moving it (no easing) or it is settling (eased).
    // The page is only offset while a pull or a refresh is on (html[data-ptr]).
    const root = document.documentElement;
    // The phone's status bar / notch: the bubble is centred in the gap below it, and always stays above the page's top edge, so it rises with the page and never overlaps it.
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:env(safe-area-inset-top, 0px);visibility:hidden;pointer-events:none';
    document.body.appendChild(probe);
    const inset = probe.getBoundingClientRect().height;
    probe.remove();
    const bubbleY = (px: number) => Math.min(inset + (px - inset - BUBBLE) / 2, px - BUBBLE);
    let clearTimer = 0;
    const draw = (px: number, progress: number, drag: boolean) => {
      window.clearTimeout(clearTimer);
      root.style.setProperty('--ptr-pull', `${px}px`);
      root.dataset.ptr = drag ? 'drag' : 'settle';
      el.style.setProperty('--ptr-y', `${bubbleY(px)}px`);
      el.style.setProperty('--ptr-p', String(Math.min(1, progress)));
      el.dataset.drag = drag ? '1' : '0';
      if (!drag && px === 0) clearTimer = window.setTimeout(() => { delete root.dataset.ptr; root.style.removeProperty('--ptr-pull'); }, 360);
    };
    const setState = (s: string) => { el.dataset.state = s; };
    const say = (t: string) => { if (live.current) live.current.textContent = t; };
    const rest = () => { phase = 'idle'; armed = false; pull = 0; setState('idle'); draw(0, 0, false); };

    const finish = () => {
      if (phase !== 'refreshing') return;
      window.clearTimeout(giveUp);
      const wait = Math.max(0, MIN_SHOW_MS - (Date.now() - shownAt)) + SETTLE_MS;
      hideTimer = window.setTimeout(() => { setState('done'); draw(0, 1, false); say('Refreshed'); hideTimer = window.setTimeout(rest, 320); }, wait);
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
    // The finger's (or wheel's) distance becomes the page's: the bubble's state, the tick at the point of no return, and the drawing.
    const applyPull = (dy: number) => {
      pull = resist(dy);
      if (el.dataset.state === 'idle' || el.dataset.state === 'done') setState('pulling');
      const nowArmed = pull >= TRIGGER;
      if (nowArmed !== armed) { armed = nowArmed; setState(armed ? 'armed' : 'pulling'); if (armed) navigator.vibrate?.(8); }
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => draw(pull, pull / TRIGGER, true));
    };
    const move = (e: TouchEvent) => {
      if (phase === 'refreshing') { if (e.cancelable) e.preventDefault(); return; }   // no scrolling while it refreshes
      if (phase !== 'pulling') return;
      const dy = e.touches[0].clientY - y0, dx = e.touches[0].clientX - x0;
      if (!locked && (Math.abs(dy) > 8 || Math.abs(dx) > 8)) locked = Math.abs(dy) > Math.abs(dx) && dy > 0 ? 'v' : 'h';   // sideways swipes and upward scrolls are not a pull
      if (locked === 'h' || window.scrollY > 0) { rest(); return; }
      if (dy <= 0) { if (pull > 0) { pull = 0; cancelAnimationFrame(frame); frame = requestAnimationFrame(() => draw(0, 0, true)); } return; }
      if (e.cancelable) e.preventDefault();   // the page itself must not rubber-band under the bubble
      applyPull(dy);
    };
    const end = () => {
      if (phase !== 'pulling') return;
      cancelAnimationFrame(frame);
      if (armed && confirmDiscardUnsaved()) beginRefresh();
      else rest();   // not far enough (or "keep my changes"): it springs back
    };
    // Desktop: scrolling up once more at the very top of the page (a trackpad's two-finger swipe, or the wheel) pulls the page down the same way, and refreshes the moment it goes past the point of no return.
    // Only a scroll that BEGINS at the top counts (a pause of a third of a second starts a new one), so flicking up to the top and overshooting never refreshes by accident.
    // The wheel moves less than a finger would (half), so one notch of a mouse wheel is not enough.
    let wheelAt = 0, wheelDy = 0, wheelTimer = 0;
    const wheel = (e: WheelEvent) => {
      if (e.ctrlKey || (phase === 'pulling' && locked !== 'w')) return;   // a pinch-zoom, or a finger pull
      if (phase === 'refreshing') { if (e.cancelable) e.preventDefault(); return; }   // the page stays put at the top while it refreshes: no scrolling either way (this also swallows the trackpad's last momentum)
      const now = performance.now(), fresh = now - wheelAt > 300;
      wheelAt = now;
      if (phase !== 'pulling') {
        const t = e.target instanceof Element ? e.target : null;
        if (!fresh || e.deltaY >= 0 || window.scrollY > 0 || !t || t.closest('[role=dialog],[role=alertdialog],input,textarea,select,[contenteditable],[data-no-pull]') || scrolledInside(t)) return;
        window.clearTimeout(hideTimer);
        wheelDy = 0; pull = 0; armed = false; locked = 'w'; phase = 'pulling';
      }
      wheelDy = Math.max(0, wheelDy - e.deltaY * 0.5);
      if (wheelDy === 0) { locked = null; rest(); return; }   // scrolled back down past where it began: ordinary scrolling again
      if (e.cancelable) e.preventDefault();
      applyPull(wheelDy);
      window.clearTimeout(wheelTimer);
      // Past the point of no return it refreshes at once (no waiting for the trackpad's momentum to die away); short of it, a short pause is "letting go" and it springs back.
      if (armed) { locked = null; if (confirmDiscardUnsaved()) beginRefresh(); else rest(); return; }
      wheelTimer = window.setTimeout(() => { locked = null; end(); }, 90);
    };
    document.addEventListener('wheel', wheel, { passive: false });
    if (standalone) {
      document.addEventListener('touchstart', start, { passive: true });
      document.addEventListener('touchmove', move, { passive: false });
      document.addEventListener('touchend', end, { passive: true });
      document.addEventListener('touchcancel', end, { passive: true });
    }
    rest();
    if (reduced) el.dataset.reduced = '1';
    return () => {
      window.clearTimeout(giveUp); window.clearTimeout(hideTimer); window.clearTimeout(clearTimer); window.clearTimeout(wheelTimer); cancelAnimationFrame(frame); delete root.dataset.ptr; root.style.removeProperty('--ptr-pull');
      window.removeEventListener(REFRESHED_EVENT, finish);
      document.removeEventListener('visibilitychange', onVis); document.removeEventListener('wheel', wheel);
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

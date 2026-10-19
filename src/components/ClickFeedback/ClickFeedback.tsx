'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

// "Did my tap work?" for every button and link on the site. Whatever someone taps, if it then really starts work (a page loading, a request being sent, a save), the thing they tapped
// shows a small spinner until that work is done, so a slow connection never looks like a tap that did nothing. A tap that starts nothing (opening a menu, a toggle) shows nothing.
// How it knows: it watches the requests the page sends. A request that starts within a moment of a tap belongs to that tap; the spinner is on from then until all of them have finished
// (or the page has moved on, or 12 s). The styles are in globals.css ([data-tg-pending]). Skip an element with data-no-pending.

const WINDOW_MS = 800;        // a request that starts this soon after a tap is the tap's
const SHOW_AFTER_MS = 120;    // not for requests that finish at once
const MIN_SHOWN_MS = 350;     // once shown, stay long enough to be seen
const GIVE_UP_MS = 12_000;

interface Req { tap: number; done: boolean }
let lastTap = { id: 0, t: -Infinity };   // the latest tap: a request that starts soon after it is its; a later tap takes over
const log: Req[] = [];
let patched = false;

function isPrefetch([input, init]: Parameters<typeof fetch>): boolean {
  try {
    const h = new Headers(init?.headers ?? (typeof input === 'object' && 'headers' in input ? input.headers : undefined));
    return h.has('next-router-prefetch');
  } catch { return false; }
}

function watchRequests() {
  if (patched || typeof window === 'undefined') return;
  patched = true;
  const original = window.fetch.bind(window);
  window.fetch = (...args: Parameters<typeof fetch>) => {
    const p = original(...args);
    // Next.js quietly loads the pages a link points to before anyone taps it; that is not something a tap started.
    if (!isPrefetch(args)) {
      const rec: Req = { tap: performance.now() - lastTap.t <= WINDOW_MS ? lastTap.id : 0, done: false };
      log.push(rec);
      if (log.length > 60) log.splice(0, log.length - 40);
      const finish = () => { rec.done = true; };
      p.then(finish, finish);   // (both ends handled here, and the caller still gets the original promise)
    }
    return p;
  };
}

/** The element a tap is "on": the nearest button or link, unless it is one that should show nothing. */
function targetOf(e: MouseEvent): HTMLElement | null {
  if (e.defaultPrevented && !(e.target as HTMLElement | null)?.closest?.('button, [role="button"]')) return null;
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return null;
  const el = (e.target as HTMLElement | null)?.closest?.('a[href], button, [role="button"]') as HTMLElement | null;
  if (!el || el.closest('[data-no-pending]')) return null;
  if ((el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true' || el.hasAttribute('data-tg-pending')) return null;
  if (el.getAttribute('role') === 'tab' || el.getAttribute('role') === 'switch') return null;
  if (el instanceof HTMLAnchorElement) {
    const href = el.getAttribute('href') ?? '';
    if (el.target === '_blank' || el.hasAttribute('download') || /^(#|mailto:|tel:|sms:|javascript:)/.test(href)) return null;
    try { if (new URL(el.href, location.href).origin !== location.origin) return null; } catch { return null; }
  }
  return el;
}

function clear(el: HTMLElement) {
  el.removeAttribute('data-tg-pending'); el.removeAttribute('aria-busy'); el.style.removeProperty('--tg-pending-color');
  if (el.hasAttribute('data-tg-rel')) { el.style.removeProperty('position'); el.removeAttribute('data-tg-rel'); }
}

export default function ClickFeedback() {
  const pathname = usePathname();

  // The page moved on: whatever was waiting for it is done.
  useEffect(() => {
    document.querySelectorAll<HTMLElement>('[data-tg-pending]').forEach(clear);
  }, [pathname]);

  useEffect(() => {
    watchRequests();
    const onClick = (e: MouseEvent) => {
      const el = targetOf(e);
      if (!el) return;
      const t0 = performance.now();
      const id = lastTap.id + 1;
      lastTap = { id, t: t0 };
      let shownAt = 0;
      const timer = window.setInterval(() => {
        const now = performance.now();
        if (!el.isConnected) { window.clearInterval(timer); return; }
        const mine = log.filter((r) => r.tap === id);
        const waiting = mine.some((r) => !r.done);
        const shown = el.hasAttribute('data-tg-pending');
        if (!shown && !el.isConnected) { window.clearInterval(timer); return; }
        if (!shown && waiting && now - t0 >= SHOW_AFTER_MS) {
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          el.style.setProperty('--tg-pending-color', cs.color);
          if (cs.position === 'static') { el.style.position = 'relative'; el.setAttribute('data-tg-rel', ''); }   // (the spinner is placed against it; a fixed or absolute one already works for that)
          el.setAttribute('data-tg-pending', r.width <= 380 && r.height <= 72 ? 'small' : 'large');
          el.setAttribute('aria-busy', 'true');
          shownAt = now;
        }
        const over = now - t0 > WINDOW_MS && !waiting;   // nothing (more) is going on
        if ((shown && !waiting && now - shownAt >= MIN_SHOWN_MS) || (!shown && over) || now - t0 > GIVE_UP_MS) {
          clear(el);
          window.clearInterval(timer);
        }
      }, 60);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  return null;
}

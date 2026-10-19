'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

// "There is more this way": anything on the site that scrolls sideways (tab bars, strips of tiles or photos, wide tables and charts, the emoji row) gets a small arrow at each end
// that is shown only while there is more to scroll to in that direction, and scrolls a good way when pressed. Nothing has to opt in: this finds the scrolling areas by itself
// (an area with overflow-x auto or scroll whose content really is wider than it) and re-checks when the page changes. The arrows are added next to the scrolling area
// (in its parent, which is made position: relative if it was not positioned) and never take space. Skip one with data-no-scroll-arrows. Styles: globals.css (.tg-scroll-arrow).

const SIZE = 28;
const CHEVRON = { left: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg>', right: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>' };

interface Tracked { el: HTMLElement; left: HTMLButtonElement; right: HTMLButtonElement; onScroll: () => void; ro: ResizeObserver; madeRelative: boolean }

export default function ScrollArrows() {
  const pathname = usePathname();

  useEffect(() => {
    const tracked = new Map<HTMLElement, Tracked>();
    let scanTimer: ReturnType<typeof setTimeout> | undefined;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

    const update = (t: Tracked) => {
      const { el } = t;
      const more = el.scrollWidth - el.clientWidth > 2 && el.clientHeight > 0;
      const atLeft = el.scrollLeft > 2, atRight = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
      const top = el.offsetTop + Math.min(el.offsetHeight / 2, 40) - SIZE / 2;
      t.left.style.top = t.right.style.top = `${Math.max(0, top)}px`;
      t.left.style.left = `${el.offsetLeft + 4}px`;
      t.right.style.left = `${el.offsetLeft + el.offsetWidth - SIZE - 4}px`;
      t.left.dataset.show = more && atLeft ? '1' : '';
      t.right.dataset.show = more && atRight ? '1' : '';
    };

    const makeButton = (dir: 'left' | 'right', el: HTMLElement) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'tg-scroll-arrow'; b.dataset.dir = dir; b.dataset.noPending = '';
      b.tabIndex = -1;   // the area itself stays the keyboard's way to scroll it; these would only add stops to the tab order
      b.setAttribute('aria-label', dir === 'left' ? 'Scroll left' : 'Scroll right');
      b.innerHTML = CHEVRON[dir];
      b.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        el.scrollBy({ left: (dir === 'left' ? -1 : 1) * Math.max(120, el.clientWidth * 0.8), behavior: reduced.matches ? 'auto' : 'smooth' });
      });
      return b;
    };

    const track = (el: HTMLElement) => {
      const parent = el.parentElement;
      if (!parent) return;
      let madeRelative = false;
      if (getComputedStyle(parent).position === 'static') { parent.style.position = 'relative'; madeRelative = true; }
      const left = makeButton('left', el), right = makeButton('right', el);
      parent.append(left, right);
      const t: Tracked = { el, left, right, madeRelative, onScroll: () => update(t), ro: new ResizeObserver(() => update(t)) };
      el.addEventListener('scroll', t.onScroll, { passive: true });
      t.ro.observe(el);
      tracked.set(el, t);
      update(t);
    };

    const untrack = (t: Tracked) => {
      t.el.removeEventListener('scroll', t.onScroll);
      t.ro.disconnect(); t.left.remove(); t.right.remove();
      if (t.madeRelative && t.el.parentElement) t.el.parentElement.style.removeProperty('position');
      tracked.delete(t.el);
    };

    const scan = () => {
      for (const t of [...tracked.values()]) if (!t.el.isConnected || t.el.parentElement !== t.left.parentElement) untrack(t);
      for (const el of document.body.querySelectorAll<HTMLElement>('*')) {
        if (!(el instanceof HTMLElement) || tracked.has(el) || el.scrollWidth <= el.clientWidth + 2 || el.clientHeight < 20) continue;
        if (/^(INPUT|TEXTAREA|SELECT|PRE|CODE|SVG|BUTTON)$/i.test(el.tagName) || el.closest('[data-no-scroll-arrows]') || el.classList.contains('tg-scroll-arrow')) continue;
        const ox = getComputedStyle(el).overflowX;
        if (ox === 'auto' || ox === 'scroll') track(el);
      }
      for (const t of tracked.values()) update(t);
    };

    // Not on every change: one look a moment after things settle (the page loaded, a tab opened, the window turned), when the browser is idle.
    const later = () => {
      clearTimeout(scanTimer);
      scanTimer = setTimeout(() => { const run = () => scan(); if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 800 }); else run(); }, 350);
    };
    later();
    const mo = new MutationObserver((muts) => { if (muts.some((m) => ![...m.addedNodes, ...m.removedNodes].every((n) => n instanceof HTMLElement && n.classList.contains('tg-scroll-arrow')))) later(); });
    mo.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', later);
    return () => {
      clearTimeout(scanTimer); mo.disconnect(); window.removeEventListener('resize', later);
      for (const t of [...tracked.values()]) untrack(t);
    };
  }, [pathname]);

  return null;
}

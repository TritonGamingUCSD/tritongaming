'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_MESSAGE = 'You have changes that haven’t been saved. Leave without saving?';

// Set while some form on screen has unsaved edits. Navigation that doesn't go
// through a link or the browser (button handlers that call router.replace, like
// the portal hub's open/close of a section) asks via confirmDiscardUnsaved()
// before leaving.
// One entry per form that is dirty right now (several can be on screen at once, and one finishing must not switch the guard off for the others).
const pending = new Map<symbol, string>();

export function confirmDiscardUnsaved(): boolean {
  const message = [...pending.values()][0];
  if (!message) return true;
  return ask(message);
}

// When a SaveBar is on screen, leaving is not a question: the page just refuses and the bar shakes red until they save or discard.
// Without a bar the old confirm dialog is used.
export const UNSAVED_BLOCKED_EVENT = 'tg:unsaved-blocked';
let barCount = 0;
export function registerSaveBar(): () => void {
  barCount += 1;
  return () => { barCount = Math.max(0, barCount - 1); };
}
function ask(message: string): boolean {
  if (barCount > 0) { window.dispatchEvent(new Event(UNSAVED_BLOCKED_EVENT)); return false; }
  return window.confirm(message);
}

// Warns before someone loses edits they haven't saved, anywhere a form holds
// local state. Pass the form's current value (any JSON-serializable shape —
// the hook compares it to a saved baseline); it returns `markSaved`, to be
// called right after a successful save so the baseline catches up.
//
// Guards every way out of the page:
//  - closing/reloading the tab or typing a new address (beforeunload — the
//    browser shows its own generic prompt, custom text isn't allowed there);
//  - clicking any in-app link (the Next.js router never fires beforeunload, so
//    a capture-phase click listener asks first and cancels the navigation if
//    they choose to stay);
//  - the browser Back button (popstate — we re-push the page's own entry when
//    they choose to stay, so Back doesn't leave them stranded mid-way).
//
// `resetKey` (optional) re-baselines when it changes — see below. `value` is compared by JSON, so a field being edited and then restored to
// what it was doesn't count as a change.
export function useUnsavedChanges<T = unknown>(value: T, message: string = DEFAULT_MESSAGE, resetKey: unknown = null) {
  const serialize = (v: unknown) => {
    try { return JSON.stringify(v); } catch { return String(Math.random()); }
  };
  const baseline = useRef<string>(serialize(value));
  const baselineValue = useRef<T>(value);
  const current = serialize(value);
  // A form that's reused for different things (e.g. an editor that opens a
  // different document) passes a resetKey: when it changes, what's on screen
  // becomes the new "saved" baseline instead of counting as an edit.
  const lastKey = useRef<string>(serialize(resetKey));
  const keyNow = serialize(resetKey);
  if (keyNow !== lastKey.current) {
    lastKey.current = keyNow;
    baseline.current = current;
    baselineValue.current = value;
  }
  const dirty = current !== baseline.current;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const guardPushed = useRef(false);
  const [, refresh] = useState(0);

  const markSaved = useCallback(() => {
    baseline.current = current;
    baselineValue.current = value;
    dirtyRef.current = false;
    refresh((n) => n + 1); // re-render so the guard releases right away
  }, [current, value]);

  useEffect(() => {
    if (!dirty) return;

    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = '';
    }

    function onClickCapture(e: MouseEvent) {
      if (!dirtyRef.current || e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // opens elsewhere — this page stays
      const anchor = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
      let url: URL;
      try { url = new URL(anchor.href, window.location.href); } catch { return; }
      if (url.origin !== window.location.origin) return; // a real page load — beforeunload covers it
      if (url.pathname === window.location.pathname && url.search === window.location.search) return; // same page (hash, etc.)
      if (!ask(message)) {
        e.preventDefault();
        e.stopPropagation();
      }
    }

    // Back and Forward. Where the browser has the Navigation API, the move is cancelled before anything happens: the router and the portal's
    // tab/section listeners never see it, so the page and the edits stay exactly as they are. Elsewhere, keep an extra history entry on top of
    // this page so Back lands on it first and we can ask.
    type Nav = { addEventListener: (t: string, f: (e: NavEvent) => void) => void; removeEventListener: (t: string, f: (e: NavEvent) => void) => void; traverseTo: (key: string) => void };
    type NavEvent = { navigationType: string; cancelable: boolean; destination: { key: string }; preventDefault: () => void };
    const nav = (window as unknown as { navigation?: Nav }).navigation;
    const guardHref = window.location.href;
    const guardState = window.history.state;
    function onNavigate(e: NavEvent) {
      if (!dirtyRef.current || e.navigationType !== 'traverse' || !e.cancelable) return;
      e.preventDefault();
      if (ask(message)) {
        // They chose to leave: don't prompt again, then make the same move.
        dirtyRef.current = false;
        nav?.removeEventListener('navigate', onNavigate);
        nav?.traverseTo(e.destination.key);
      }
    }
    function onPopState(e: PopStateEvent) {
      if (!dirtyRef.current) return;
      if (ask(message)) {
        dirtyRef.current = false;
        window.removeEventListener('popstate', onPopState, true);
        window.history.back();
      } else {
        e.stopImmediatePropagation();
        window.history.pushState(guardState, '', guardHref);
      }
    }
    if (nav?.addEventListener) {
      nav.addEventListener('navigate', onNavigate);
    } else {
      window.history.pushState(guardState, '', guardHref);
      guardPushed.current = true;
      window.addEventListener('popstate', onPopState, true);
    }

    const token = Symbol('unsaved');
    pending.set(token, message);
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('click', onClickCapture, true);
    return () => {
      pending.delete(token);
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClickCapture, true);
      window.removeEventListener('popstate', onPopState, true);
      nav?.removeEventListener('navigate', onNavigate);
    };
  }, [dirty, message]);

  // Once everything's saved (or edits undone) the extra history entry is no
  // longer needed — step back over it so Back works normally again, instead
  // of needing two presses.
  useEffect(() => {
    if (!dirty && guardPushed.current) {
      guardPushed.current = false;
      window.history.back();
    }
  }, [dirty]);

  /** What was last saved: hand it back to the form's state to throw the edits away. */
  const saved = () => baselineValue.current;
  return { dirty, markSaved, saved };
}

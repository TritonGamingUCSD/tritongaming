'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_MESSAGE = 'You have changes that haven’t been saved. Leave without saving?';

// Set while some form on screen has unsaved edits. Navigation that doesn't go
// through a link or the browser (button handlers that call router.replace, like
// the portal hub's open/close of a section) asks via confirmDiscardUnsaved()
// before leaving.
let pendingMessage: string | null = null;

export function confirmDiscardUnsaved(): boolean {
  if (!pendingMessage) return true;
  return window.confirm(pendingMessage);
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
export function useUnsavedChanges(value: unknown, message: string = DEFAULT_MESSAGE, resetKey: unknown = null) {
  const serialize = (v: unknown) => {
    try { return JSON.stringify(v); } catch { return String(Math.random()); }
  };
  const baseline = useRef<string>(serialize(value));
  const current = serialize(value);
  // A form that's reused for different things (e.g. an editor that opens a
  // different document) passes a resetKey: when it changes, what's on screen
  // becomes the new "saved" baseline instead of counting as an edit.
  const lastKey = useRef<string>(serialize(resetKey));
  const keyNow = serialize(resetKey);
  if (keyNow !== lastKey.current) {
    lastKey.current = keyNow;
    baseline.current = current;
  }
  const dirty = current !== baseline.current;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const guardPushed = useRef(false);
  const [, refresh] = useState(0);

  const markSaved = useCallback(() => {
    baseline.current = current;
    dirtyRef.current = false;
    refresh((n) => n + 1); // re-render so the guard releases right away
  }, [current]);

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
      if (!window.confirm(message)) {
        e.preventDefault();
        e.stopPropagation();
      }
    }

    // Back button: keep an extra history entry on top of this page so that
    // pressing Back lands on it first, where we can ask.
    window.history.pushState(window.history.state, '', window.location.href);
    guardPushed.current = true;
    function onPopState() {
      if (!dirtyRef.current) return;
      if (window.confirm(message)) {
        // They chose to leave: don't prompt again (the browser's own
        // beforeunload check included), and step back past the guard entry.
        dirtyRef.current = false;
        window.removeEventListener('popstate', onPopState);
        window.history.back();
      } else {
        window.history.pushState(window.history.state, '', window.location.href);
      }
    }

    pendingMessage = message;
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('click', onClickCapture, true);
    window.addEventListener('popstate', onPopState);
    return () => {
      if (pendingMessage === message) pendingMessage = null;
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClickCapture, true);
      window.removeEventListener('popstate', onPopState);
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

  return { dirty, markSaved };
}

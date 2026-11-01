'use client';

import { useCallback, useRef, useState } from 'react';

/** What the history holds: the value now, and the values before and after it. */
interface Timeline<T> {
  past: T[];
  present: T;
  future: T[];
}

const KEEP = 100;
const MERGE_MS = 900;

// A value you can undo and redo, like the studio of a design tool. `set` is one step (typing in the same box (same `key`) within a moment is one step, not a step per letter); `drag` follows a drag (the whole drag is one step, made by its first move) and
// `endDrag` ends it; `reset` starts over with a value and no history (after loading or saving).
export function useHistory<T>(initial: T) {
  const [line, setLine] = useState<Timeline<T>>({ past: [], present: initial, future: [] });
  const dragging = useRef(false);
  const last = useRef<{ key: string; at: number } | null>(null);

  const set = useCallback((next: T, key?: string) => {
    setLine((l) => {
      const now = Date.now();
      const merge = !!key && last.current?.key === key && now - last.current.at < MERGE_MS;
      last.current = key ? { key, at: now } : null;
      return merge ? { ...l, present: next, future: [] } : { past: [...l.past, l.present].slice(-KEEP), present: next, future: [] };
    });
  }, []);

  const drag = useCallback((next: T) => {
    const first = !dragging.current; // the first move of a drag makes the one step; the rest just follow
    dragging.current = true;
    last.current = null;
    setLine((l) => (first ? { past: [...l.past, l.present].slice(-KEEP), present: next, future: [] } : { ...l, present: next }));
  }, []);

  const endDrag = useCallback(() => {
    dragging.current = false;
  }, []);

  const undo = useCallback(() => {
    last.current = null;
    setLine((l) => (l.past.length ? { past: l.past.slice(0, -1), present: l.past[l.past.length - 1], future: [l.present, ...l.future] } : l));
  }, []);
  const redo = useCallback(() => {
    last.current = null;
    setLine((l) => (l.future.length ? { past: [...l.past, l.present], present: l.future[0], future: l.future.slice(1) } : l));
  }, []);
  const reset = useCallback((value: T) => {
    last.current = null;
    dragging.current = false;
    setLine({ past: [], present: value, future: [] });
  }, []);

  return { value: line.present, set, drag, endDrag, undo, redo, reset, canUndo: line.past.length > 0, canRedo: line.future.length > 0 };
}

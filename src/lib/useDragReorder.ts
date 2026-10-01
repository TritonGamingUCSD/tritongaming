'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Drag-to-reorder for lists, built on pointer events (not HTML5 drag-and-drop)
// so the same grip works with a mouse, a finger and a stylus — HTML5 DnD is
// unreliable on phones, which is why lists used to carry up/down arrow buttons
// as well. With dragging dependable everywhere, the arrows are gone; keyboard
// users reorder by focusing the grip and pressing ↑ / ↓.
//
// Usage — the same two spots per row as before:
//   `dragHandleProps(i)`  on a small grip element,
//   `dropTargetProps(i)`  on the whole row (so a drop anywhere on it lands).
export function useDragReorder<T>(items: T[], onReorder: (next: T[]) => void) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const reorderRef = useRef(onReorder);
  reorderRef.current = onReorder;
  const focusAfterMove = useRef<number | null>(null);

  const move = useCallback((from: number, to: number) => {
    const list = itemsRef.current;
    if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return;
    const next = [...list];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    reorderRef.current(next);
  }, []);

  // After a keyboard move, put focus back on the grip of the row that moved.
  useEffect(() => {
    if (focusAfterMove.current === null) return;
    const idx = focusAfterMove.current;
    focusAfterMove.current = null;
    (document.querySelector(`[data-drag-handle="${idx}"]`) as HTMLElement | null)?.focus();
  });

  function dragHandleProps(index: number) {
    return {
      role: 'button' as const,
      tabIndex: 0,
      'data-drag-handle': index,
      style: { touchAction: 'none' as const, cursor: 'grab', userSelect: 'none' as const },
      onPointerDown: (e: React.PointerEvent) => {
        if (e.button !== undefined && e.button !== 0) return; // primary button / touch / pen only
        e.preventDefault();
        setDragIndex(index);
        setOverIndex(index);
        let over = index;

        const onMove = (ev: PointerEvent) => {
          const el = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('[data-drag-index]');
          const idx = el ? Number(el.getAttribute('data-drag-index')) : null;
          if (idx !== null && !Number.isNaN(idx) && idx !== over) { over = idx; setOverIndex(idx); }
          // Scroll the page when dragging near the top/bottom edge.
          if (ev.clientY < 70) window.scrollBy(0, -14);
          else if (ev.clientY > window.innerHeight - 70) window.scrollBy(0, 14);
        };
        const finish = (commit: boolean) => {
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
          window.removeEventListener('pointercancel', onCancel);
          if (commit && over !== index) move(index, over);
          setDragIndex(null);
          setOverIndex(null);
        };
        const onUp = () => finish(true);
        const onCancel = () => finish(false);
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onCancel);
      },
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        e.preventDefault();
        const to = index + (e.key === 'ArrowUp' ? -1 : 1);
        if (to < 0 || to >= itemsRef.current.length) return;
        focusAfterMove.current = to;
        move(index, to);
      },
    };
  }

  function dropTargetProps(index: number) {
    return { 'data-drag-index': index };
  }

  return { dragIndex, overIndex, dragHandleProps, dropTargetProps };
}

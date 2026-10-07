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
//
// The list moves live while you drag: render `view` (not `items`) and the other rows slide out of the way before you let go. `dragIndex` is where the
// dragged row sits right now. Nothing is saved until the drop (`onReorder` runs once, on release).
// `group` names this list when several lists are on screen at once (one table per area): a drag only lands on rows of its own list.
export function useDragReorder<T>(items: T[], onReorder: (next: T[]) => void, group?: string) {
  const [drag, setDrag] = useState<{ from: number; at: number } | null>(null);
  const dragIndex = drag ? drag.at : null;
  const overIndex: number | null = null;   // no drop line any more: the rows themselves show where it will land
  const view = (() => {
    if (!drag || drag.from === drag.at || drag.from >= items.length || drag.at >= items.length) return items;
    const next = [...items];
    const [moved] = next.splice(drag.from, 1);
    next.splice(drag.at, 0, moved);
    return next;
  })();
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
    (document.querySelector(`[data-drag-handle="${idx}"]${group !== undefined ? `[data-drag-group="${group}"]` : ''}`) as HTMLElement | null)?.focus();
  });

  function dragHandleProps(index: number) {
    return {
      role: 'button' as const,
      tabIndex: 0,
      'data-drag-handle': index,
      ...(group !== undefined ? { 'data-drag-group': group } : {}),
      style: { touchAction: 'none' as const, cursor: 'grab', userSelect: 'none' as const },
      onPointerDown: (e: React.PointerEvent) => {
        if (e.button !== undefined && e.button !== 0) return; // primary button / touch / pen only
        e.preventDefault();
        setDrag({ from: index, at: index });
        let over = index;

        const onMove = (ev: PointerEvent) => {
          const hit = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('[data-drag-index]');
          const el = hit && (group === undefined || hit.getAttribute('data-drag-group') === group) ? hit : null;
          const idx = el ? Number(el.getAttribute('data-drag-index')) : null;
          if (idx !== null && !Number.isNaN(idx) && idx !== over) { over = idx; setDrag({ from: index, at: idx }); }
          // Scroll the page when dragging near the top/bottom edge.
          if (ev.clientY < 70) window.scrollBy(0, -14);
          else if (ev.clientY > window.innerHeight - 70) window.scrollBy(0, 14);
        };
        const finish = (commit: boolean) => {
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
          window.removeEventListener('pointercancel', onCancel);
          if (commit && over !== index) move(index, over);
          setDrag(null);
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
    return { 'data-drag-index': index, ...(group !== undefined ? { 'data-drag-group': group } : {}) };
  }

  return { view, dragIndex, overIndex, dragHandleProps, dropTargetProps };
}

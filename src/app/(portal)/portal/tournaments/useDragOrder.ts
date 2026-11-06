'use client';

import { useState, type DragEvent } from 'react';

// Drag to reorder a list: give each row `rowProps(id)`; when a row is dropped on another, `onReorder` gets the new order of ids. The row under the pointer is marked (data-drop) so a line can show where it will land, and the dragged one is dimmed (data-dragging).
export function useDragOrder(ids: string[], onReorder: (ids: string[]) => void, disabled = false) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const reset = () => {
    setDragId(null);
    setOverId(null);
  };
  const rowProps = (id: string) => ({
    draggable: !disabled,
    'data-dragging': dragId === id ? '' : undefined,
    'data-drop': overId === id && dragId !== null && dragId !== id ? (ids.indexOf(dragId) < ids.indexOf(id) ? 'after' : 'before') : undefined,
    onDragStart: (e: DragEvent) => {
      setDragId(id);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', id);
    },
    onDragOver: (e: DragEvent) => {
      if (!dragId) return;
      e.preventDefault();
      if (overId !== id) setOverId(id);
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      if (dragId && dragId !== id) {
        const next = ids.filter((x) => x !== dragId);
        const at = next.indexOf(id);
        next.splice(ids.indexOf(dragId) < ids.indexOf(id) ? at + 1 : at, 0, dragId);
        onReorder(next);
      }
      reset();
    },
    onDragEnd: reset,
  });
  return { rowProps, dragging: dragId };
}

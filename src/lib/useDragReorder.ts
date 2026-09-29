'use client';

import { useState } from 'react';

// Native HTML5 drag-and-drop reordering — no extra dependency needed.
// Meant to be split across two spots on each row: `dragHandleProps(i)` goes
// on a small dedicated grip element (so dragging never fights with
// selecting text in an input next to it), and `dropTargetProps(i)` goes on
// the row/card itself (so dropping anywhere on a row, not just exactly on
// the handle, lands the reorder). Every caller of this hook keeps its
// existing up/down buttons alongside the handle — HTML5 drag-and-drop has
// weak/inconsistent touch support, so buttons stay the reliable path on
// mobile.
export function useDragReorder<T>(items: T[], onReorder: (next: T[]) => void) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  function dragHandleProps(index: number) {
    return {
      draggable: true,
      onDragStart: (e: React.DragEvent) => {
        setDragIndex(index);
        e.dataTransfer.effectAllowed = 'move';
        // Firefox refuses to start a drag at all unless some data is set.
        e.dataTransfer.setData('text/plain', String(index));
      },
      onDragEnd: () => {
        setDragIndex(null);
        setOverIndex(null);
      },
    };
  }

  function dropTargetProps(index: number) {
    return {
      onDragOver: (e: React.DragEvent) => {
        if (dragIndex === null) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (index !== overIndex) setOverIndex(index);
      },
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        if (dragIndex === null || dragIndex === index) { setDragIndex(null); setOverIndex(null); return; }
        const next = [...items];
        const [moved] = next.splice(dragIndex, 1);
        next.splice(index, 0, moved);
        onReorder(next);
        setDragIndex(null);
        setOverIndex(null);
      },
    };
  }

  return { dragIndex, overIndex, dragHandleProps, dropTargetProps };
}

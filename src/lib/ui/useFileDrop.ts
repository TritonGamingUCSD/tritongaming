'use client';

import { useEffect, useRef, useState } from 'react';

// Drag and drop for a file picker: spread `dropProps` on the box that should take the files and give it `data-dropping={over || undefined}` so it lights up while a file is over it
// (portal-controls.css draws that). Only real files count, so dragging a tile or text around the page never triggers it.
// A copied picture can also be pasted (Ctrl/Cmd+V) while the pointer is over the box or focus is inside it, unless `paste: false`; only pictures are taken from the clipboard, so pasting text anywhere is untouched.
export function useFileDrop(onFiles: (files: File[]) => void, opts: { disabled?: boolean; paste?: boolean } = {}) {
  const [over, setOver] = useState(false);
  const depth = useRef(0);
  const near = useRef({ hover: false, focus: false });
  const latest = useRef({ onFiles, disabled: opts.disabled });
  latest.current = { onFiles, disabled: opts.disabled };
  const pasteOn = opts.paste !== false;
  useEffect(() => {
    if (!pasteOn) return;
    const onPaste = (e: ClipboardEvent) => {
      if (latest.current.disabled || (!near.current.hover && !near.current.focus)) return;
      const pics = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith('image/'));
      if (!pics.length) return;
      e.preventDefault(); latest.current.onFiles(pics);
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [pasteOn]);
  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');
  const dropProps = {
    onPointerEnter: () => { near.current.hover = true; },
    onPointerLeave: () => { near.current.hover = false; },
    onFocus: () => { near.current.focus = true; },
    onBlur: (e: React.FocusEvent) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) near.current.focus = false; },
    onDragEnter: (e: React.DragEvent) => { if (opts.disabled || !hasFiles(e)) return; e.preventDefault(); depth.current += 1; setOver(true); },
    onDragOver: (e: React.DragEvent) => { if (opts.disabled || !hasFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; },
    onDragLeave: (e: React.DragEvent) => { if (!hasFiles(e)) return; depth.current = Math.max(0, depth.current - 1); if (depth.current === 0) setOver(false); },
    onDrop: (e: React.DragEvent) => {
      if (opts.disabled || !hasFiles(e)) return;
      e.preventDefault(); depth.current = 0; setOver(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length) onFiles(files);
    },
  };
  return { over, dropProps };
}

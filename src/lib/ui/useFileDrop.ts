'use client';

import { useRef, useState } from 'react';

// Drag and drop for a file picker: spread `dropProps` on the box that should take the files and give it `data-dropping={over || undefined}` so it lights up while a file is over it
// (portal-controls.css draws that). Only real files count, so dragging a tile or text around the page never triggers it.
export function useFileDrop(onFiles: (files: File[]) => void, opts: { disabled?: boolean } = {}) {
  const [over, setOver] = useState(false);
  const depth = useRef(0);
  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');
  const dropProps = {
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

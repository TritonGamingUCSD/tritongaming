'use client';

import { useRef, useState } from 'react';

// Drag and drop for a file picker (a font file, for example): spread `dropProps` on the box that should take the files and give it `data-dropping={over || undefined}` so it lights up while a file is over it
// (portal-controls.css draws that). Only real files count, so dragging a tile or text around the page never triggers it.
// Pictures do not use this: they go through PictureDialog, which has its own drop area and paste, so nothing is ever pasted by accident.
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

// Pictures on the clipboard, read when a "Paste picture" button is pressed. `denied` is true when the browser would not let the page look (then Ctrl/Cmd+V over the box is the way).
export async function readClipboardPictures(): Promise<{ files: File[]; denied: boolean }> {
  try {
    if (!navigator.clipboard?.read) return { files: [], denied: true };
    const files: File[] = [];
    for (const item of await navigator.clipboard.read()) {
      const type = item.types.find((t) => t.startsWith('image/'));
      if (type) files.push(new File([await item.getType(type)], `pasted.${type.split('/')[1] || 'png'}`, { type }));
    }
    return { files, denied: false };
  } catch { return { files: [], denied: true }; }
}

'use client';

import { useState } from 'react';
import { ClipboardPaste } from 'lucide-react';
import Button from '@/components/ui/Button';
import { readClipboardPictures } from '@/lib/ui/useFileDrop';

// The visible way to paste a copied picture, beside every picture upload: one tap reads the clipboard (the browser may ask once) and hands over the pictures.
// Ctrl/Cmd+V over the box still works too (useFileDrop), but nobody finds that on their own.
export default function PasteButton({ onFiles, label = 'Paste picture', iconOnly, disabled }: { onFiles: (files: File[]) => void; label?: string; iconOnly?: boolean; disabled?: boolean }) {
  const [note, setNote] = useState('');
  const go = async () => {
    setNote('');
    const r = await readClipboardPictures();
    if (r.files.length) onFiles(r.files); else setNote(r.denied ? 'Press Ctrl+V (⌘V on a Mac) over the box instead.' : 'Copy a picture first, then press Paste.');
  };
  return (
    <>
      <Button variant="secondary" size="sm" disabled={disabled} onClick={() => void go()} aria-label={iconOnly ? label : undefined} title={label}>
        <ClipboardPaste size={15} strokeWidth={1.75} aria-hidden="true" />{!iconOnly && ` ${label}`}
      </Button>
      {note && <span role="status" style={{ fontSize: '0.78rem', color: 'var(--pp-bad)' }}>{note}</span>}
    </>
  );
}

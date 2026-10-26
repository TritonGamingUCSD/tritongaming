'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ClipboardPaste, ImagePlus, Trash2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import Dialog, { DialogActions, DialogCancel } from '@/components/ui/Dialog';
import { readClipboardPictures } from '@/lib/ui/useFileDrop';
import styles from './PictureDialog.module.css';

// The one way to choose a picture, wherever one can be set (profile photo, a trivia question, an emoji, a QR logo, a screenshot…).
// Opened by clicking the picture's own box. Inside: a big area to click or drop a file on, a Paste button (Ctrl/Cmd+V works too, but only while this is open, so it can't fire by accident),
// then a preview with "Use This Picture" so a wrong pick is never saved. Dropping or pasting on the page itself does nothing.
// The caller does the real work in `onUse` (shrink, crop, upload); the dialog closes when that finishes.
export default function PictureDialog({ title, current, accept = 'image/*', hint, multiple, onUse, onRemove, onClose }: {
  title: string; current?: string; accept?: string; hint?: string; multiple?: boolean;
  onUse: (files: File[]) => void | Promise<void>; onRemove?: () => void | Promise<void>; onClose: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const take = (list: File[]) => {
    const pics = list.filter((f) => f.type.startsWith('image/'));
    if (!pics.length) { setNote('That isn’t a picture. Choose a PNG, JPG, WebP or similar image.'); return; }
    setNote(''); setFiles(multiple ? pics : pics.slice(0, 1));
  };
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const pics = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith('image/'));
      if (!pics.length) return;
      e.preventDefault(); take(pics);
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  });
  const paste = async () => {
    const r = await readClipboardPictures();
    if (r.files.length) take(r.files); else setNote(r.denied ? 'The browser wouldn’t let the page look. Press Ctrl+V (⌘V on a Mac) instead.' : 'There is no picture on the clipboard. Copy one first, then press Paste.');
  };
  const run = async (fn: () => void | Promise<void>) => { setBusy(true); try { await fn(); onClose(); } finally { setBusy(false); } };
  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');

  return (
    <Dialog title={title} onClose={onClose} busy={busy}>
      <input ref={input} type="file" accept={accept} multiple={multiple} hidden onChange={(e) => { take(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
      {previews.length ? (
        <div className={styles.previewBox}>
          {previews.map((u, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={u} src={u} alt={`Chosen picture ${i + 1}`} className={styles.preview} />
          ))}
        </div>
      ) : (
        <button type="button" className={styles.drop} data-over={over || undefined} onClick={() => input.current?.click()}
          onDragEnter={(e) => { if (hasFiles(e)) { e.preventDefault(); setOver(true); } }}
          onDragOver={(e) => { if (hasFiles(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { if (!hasFiles(e)) return; e.preventDefault(); setOver(false); take(Array.from(e.dataTransfer.files)); }}>
          {current ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={current} alt="Current picture" className={styles.preview} style={{ maxHeight: '7rem' }} />
          ) : <ImagePlus size={30} strokeWidth={1.5} aria-hidden="true" />}
          <span className={styles.dropTitle}>Drop a picture here, or click to choose</span>
          <span className={styles.dropSub}>{hint ?? 'PNG, JPG or WebP'}</span>
        </button>
      )}
      <div className={styles.row}>
        <Button variant="secondary" size="sm" disabled={busy} onClick={() => void paste()}><ClipboardPaste size={15} strokeWidth={1.75} aria-hidden="true" /> Paste Picture</Button>
        {previews.length > 0 && <Button variant="ghost" size="sm" disabled={busy} onClick={() => input.current?.click()}>Choose Another</Button>}
        {onRemove && current && !previews.length && <Button variant="danger" size="sm" disabled={busy} onClick={() => void run(onRemove)}><Trash2 size={15} strokeWidth={1.75} aria-hidden="true" /> Remove Current</Button>}
      </div>
      <p className={styles.hint}>Copied a picture? Press Ctrl+V (⌘V on a Mac) here, or use Paste Picture.</p>
      {note && <p role="status" className={styles.note}>{note}</p>}
      <DialogActions>
        <DialogCancel onClick={onClose} disabled={busy} />
        <Button disabled={!files.length} loading={busy} onClick={() => void run(() => onUse(files))} style={{ flex: 1 }}>Use This Picture</Button>
      </DialogActions>
    </Dialog>
  );
}

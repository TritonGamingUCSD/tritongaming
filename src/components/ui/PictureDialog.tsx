'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ClipboardPaste, Crop, ImagePlus, Trash2, Undo2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import Dialog, { DialogActions, DialogCancel } from '@/components/ui/Dialog';
import CropBox from '@/components/ui/CropBox';
import { readClipboardPictures } from '@/lib/ui/useFileDrop';
import { toSource } from '@/lib/ui/cropMath';
import styles from './PictureDialog.module.css';

// The one way to choose a picture, wherever one can be set (profile photo, a trivia question, an emoji, a QR logo, a screenshot…).
// Opened by clicking the picture's own box. Inside: a big area to click or drop a file on, a Paste button (Ctrl/Cmd+V works too, but only while this is open, so it can't fire by accident),
// then a preview with "Use This Picture" so a wrong pick is never saved. Dropping or pasting on the page itself does nothing.
// Under a chosen picture a Crop button opens a box to move and resize on it (Free, Square, 4:3… or the one shape the place needs: `aspect`, with `round` showing a circle guide); Undo Crop brings the original back.
// A cropped picture is cut at its full size and handed on as an ordinary file (a GIF or SVG becomes a still PNG once cropped), so every caller gets it with no extra work.
// The caller does the real work in `onUse` (shrink, upload); the dialog closes when that finishes.
export default function PictureDialog({ title, current, accept = 'image/*', hint, multiple, aspect, round, onUse, onRemove, onClose }: {
  title: string; current?: string; accept?: string; hint?: string; multiple?: boolean; aspect?: number; round?: boolean;
  onUse: (files: File[]) => void | Promise<void>; onRemove?: () => void | Promise<void>; onClose: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [originals, setOriginals] = useState<(File | null)[]>([]);   // for each chosen picture, the file as it was before it was cropped
  const [cropAt, setCropAt] = useState<number | null>(null);

  const take = (list: File[]) => {
    const pics = list.filter((f) => f.type.startsWith('image/'));
    if (!pics.length) { setNote('That isn’t a picture. Choose a PNG, JPG, WebP or similar image.'); return; }
    const chosen = multiple ? pics : pics.slice(0, 1);
    setNote(''); setFiles(chosen); setOriginals(chosen.map(() => null)); setCropAt(null);
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
  const cropFile = async (i: number, box: { x: number; y: number; w: number; h: number }) => {
    const file = files[i];
    try {
      const url = URL.createObjectURL(file);
      const img = await new Promise<HTMLImageElement>((res, rej) => { const el = new Image(); el.onload = () => res(el); el.onerror = rej; el.src = url; });
      URL.revokeObjectURL(url);
      const nw = img.naturalWidth || 512, nh = img.naturalHeight || 512;
      const { sx, sy, sw, sh } = toSource({ x: box.x * nw, y: box.y * nh, w: box.w * nw, h: box.h * nh }, nw, nh, nw, nh);
      if (sw >= nw && sh >= nh) { setCropAt(null); return; }   // the whole picture: nothing changes
      const canvas = document.createElement('canvas');
      canvas.width = sw; canvas.height = sh;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('no canvas');
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      const type = file.type === 'image/jpeg' || file.type === 'image/webp' ? file.type : 'image/png';   // a GIF or SVG becomes a still PNG
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, type, 0.92));
      if (!blob) throw new Error('no blob');
      const base = file.name.replace(/\.[^.]+$/, '') || 'picture', ext = type === 'image/jpeg' ? 'jpg' : type === 'image/webp' ? 'webp' : 'png';
      const cropped = new File([blob], `${base}-cropped.${ext}`, { type });
      setOriginals((o) => o.map((x, k) => (k === i ? x ?? file : x)));
      setFiles((f) => f.map((x, k) => (k === i ? cropped : x)));
      setNote(''); setCropAt(null);
    } catch { setNote('That picture couldn’t be cropped here. You can still use it whole.'); setCropAt(null); }
  };
  const undoCrop = (i: number) => { const o = originals[i]; if (!o) return; setFiles((f) => f.map((x, k) => (k === i ? o : x))); setOriginals((a) => a.map((x, k) => (k === i ? null : x))); };
  const run = async (fn: () => void | Promise<void>) => { setBusy(true); try { await fn(); onClose(); } finally { setBusy(false); } };
  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');

  return (
    <Dialog title={title} onClose={onClose} busy={busy}>
      <input ref={input} type="file" accept={accept} multiple={multiple} hidden onChange={(e) => { take(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
      {cropAt !== null && previews[cropAt] ? (
        <>
          <CropBox src={previews[cropAt]} fixed={aspect} round={round} onCancel={() => setCropAt(null)} onApply={(box) => void cropFile(cropAt, box)} />
          {/^image\/(gif|svg)/.test(files[cropAt].type) && <p className={styles.hint}>A GIF or SVG becomes a still picture once it is cropped. Press Back to keep it as it is.</p>}
        </>
      ) : previews.length ? (
        <div className={styles.previewBox}>
          {previews.map((u, i) => (
            <figure key={u} className={styles.chosen}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt={`Chosen picture ${i + 1}`} className={styles.preview} />
              <figcaption className={styles.chosenTools}>
                <button type="button" className={styles.tool} disabled={busy} onClick={() => setCropAt(i)}><Crop size={14} strokeWidth={1.75} aria-hidden="true" /> Crop</button>
                {originals[i] && <button type="button" className={styles.tool} disabled={busy} onClick={() => undoCrop(i)}><Undo2 size={14} strokeWidth={1.75} aria-hidden="true" /> Undo Crop</button>}
              </figcaption>
            </figure>
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
      {cropAt === null && <div className={styles.row}>
        <Button variant="secondary" size="sm" disabled={busy} onClick={() => void paste()}><ClipboardPaste size={15} strokeWidth={1.75} aria-hidden="true" /> Paste Picture</Button>
        {previews.length > 0 && <Button variant="ghost" size="sm" disabled={busy} onClick={() => input.current?.click()}>Choose Another</Button>}
        {onRemove && current && !previews.length && <Button variant="danger" size="sm" disabled={busy} onClick={() => void run(onRemove)}><Trash2 size={15} strokeWidth={1.75} aria-hidden="true" /> Remove Current</Button>}
      </div>}
      {cropAt === null && <p className={styles.hint}>Copied a picture? Press Ctrl+V (⌘V on a Mac) here, or use Paste Picture.</p>}
      {note && <p role="status" className={styles.note}>{note}</p>}
      {cropAt === null && <DialogActions>
        <DialogCancel onClick={onClose} disabled={busy} />
        <Button disabled={!files.length} loading={busy} onClick={() => void run(() => onUse(files))} style={{ flex: 1 }}>Use This Picture</Button>
      </DialogActions>}
    </Dialog>
  );
}

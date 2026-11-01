'use client';

import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Trash2, Type } from 'lucide-react';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import PictureDialog from '@/components/ui/PictureDialog';
import ColorInput from '@/components/ui/ColorInput';
import { Field, Input } from '@/components/ui/Field';
import { confirmHold } from '@/lib/ui/confirmHold';
import { MAX_STICKERS_PER_BOOTH, type Overlay } from '@/lib/photobooth/booth';
import { DEFAULT_TEXT_STICKER, drawTextSticker, renderTextSticker, type TextSticker } from '@/lib/photobooth/design';
import { shrinkOverlay } from '@/lib/photobooth/shrink';
import { call, uploadSticker } from './api';
import styles from './photobooth.module.css';

/** Where a new sticker starts: the middle of the photo, a good size. */
const START = { x: 0.5, y: 0.5, size: 0.4, can_resize: true, can_rotate: true };

// The stickers tool: the stickers this booth offers (guests drag them into place on the live camera). Add one from a picture or from words, then drag it on the picture to where guests should find it first; here are its name,
// its size and what a guest may do with it. Adding and removing happens at once; where they start is saved with the rest of the booth.
export function StickersPanel({
  booth,
  stickers,
  selectedId,
  onSelect,
  onChange,
  onAdded,
  onRemoved,
}: {
  booth: string;
  stickers: Overlay[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (id: string, patch: Partial<Overlay>, key?: string) => void;
  onAdded: (o: Overlay) => void;
  onRemoved: (id: string) => void;
}) {
  const [picking, setPicking] = useState(false);
  const [words, setWords] = useState<TextSticker | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const cur = stickers.find((s) => s.id === selectedId) ?? null;
  const full = stickers.length >= MAX_STICKERS_PER_BOOTH;

  useEffect(() => {
    if (words && canvas.current) drawTextSticker(canvas.current, words);
  }, [words]);

  const add = async (name: string, blob: Blob) => {
    setBusy(true);
    setError('');
    const r = await uploadSticker(booth, { name, blob, sticker: START });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    onAdded(r.overlay);
    onSelect(r.overlay.id);
  };
  const addPicture = async (files: File[]) => {
    const f = files[0];
    setPicking(false);
    if (!f) return;
    const blob = await shrinkOverlay(f);
    if (!blob) return setError('That picture couldn’t be made small enough. Try a simpler or smaller one.');
    await add(f.name.replace(/\.[^.]+$/, '').slice(0, 60) || 'Sticker', blob);
  };
  const addWords = async () => {
    if (!words) return;
    const blob = await renderTextSticker(words);
    if (!blob) return setError('This browser could not make the picture. Try Chrome or Safari.');
    await add(words.text.trim().slice(0, 60) || 'Sticker', blob);
    setWords(null);
  };
  const remove = async (s: Overlay) => {
    if (!(await confirmHold({ title: `Remove "${s.name}"?`, message: 'It is taken off this booth.', confirmLabel: 'Hold to remove' }))) return;
    const r = await call(`/api/photobooth/booths/${booth}/stickers/${s.id}`, 'DELETE');
    if (r.ok) onRemoved(s.id);
    else setError(r.error);
  };

  return (
    <div className={styles.tools}>
      <p className={styles.hint}>Guests drag these onto the live camera. Drag one on the picture to set where it starts.</p>
      <div className={styles.rowActions}>
        <Button size="sm" variant="secondary" disabled={full || busy} onClick={() => setPicking(true)}>
          <ImagePlus size={15} aria-hidden="true" /> Add A Picture
        </Button>
        <Button size="sm" variant="secondary" disabled={full || busy} onClick={() => setWords(words ? null : DEFAULT_TEXT_STICKER)}>
          <Type size={15} aria-hidden="true" /> Add Words
        </Button>
      </div>
      {full && <p className={styles.hint}>A booth can offer up to {MAX_STICKERS_PER_BOOTH} stickers.</p>}
      {words && (
        <fieldset className={`${styles.group} ${styles.groupOn}`}>
          <legend>New Words Sticker</legend>
          <canvas ref={canvas} className={styles.wordsCanvas} aria-label="The sticker" />
          <Field label="Words" hint="A hashtag, a name, a joke">
            <Input value={words.text} maxLength={40} onChange={(e) => setWords({ ...words, text: e.target.value })} />
          </Field>
          <div className={styles.pair}>
            <Field label="Words colour">
              <ColorInput value={words.color} onChange={(e) => setWords({ ...words, color: e.target.value })} aria-label="Words colour" />
            </Field>
            <Field label="Outline colour">
              <ColorInput value={words.outline} onChange={(e) => setWords({ ...words, outline: e.target.value })} aria-label="Outline colour" />
            </Field>
          </div>
          <label className={styles.check}>
            <input type="checkbox" checked={!!words.pill} onChange={(e) => setWords({ ...words, pill: e.target.checked ? '#011941' : '' })} /> A plate behind the words
          </label>
          {words.pill && <ColorInput value={words.pill} onChange={(e) => setWords({ ...words, pill: e.target.value })} aria-label="Plate colour" />}
          <div className={styles.rowActions}>
            <Button size="sm" loading={busy} disabled={!words.text.trim()} onClick={() => void addWords()}>
              Add To The Picture
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setWords(null)}>
              Cancel
            </Button>
          </div>
        </fieldset>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      {stickers.length === 0 ? (
        <p className={styles.empty}>No stickers yet. This booth works without them.</p>
      ) : (
        <ul className={styles.stickerChips}>
          {stickers.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className={`${styles.stickerChip} ${s.id === selectedId ? styles.stickerChipOn : ''}`}
                onClick={() => onSelect(s.id === selectedId ? null : s.id)}
                aria-pressed={s.id === selectedId}
                aria-label={s.name}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.image} alt="" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {cur && (
        <fieldset className={`${styles.group} ${styles.groupOn}`}>
          <legend>Selected Sticker</legend>
          <Field label="Name">
            <Input value={cur.name} maxLength={60} onChange={(e) => onChange(cur.id, { name: e.target.value }, `name-${cur.id}`)} />
          </Field>
          <label className={styles.slider}>
            <span>Size</span>
            <input type="range" min={0.05} max={1} step={0.01} value={cur.size} onChange={(e) => onChange(cur.id, { size: Number(e.target.value) }, `size-${cur.id}`)} />
          </label>
          <label className={styles.check}>
            <input type="checkbox" checked={cur.can_resize} onChange={(e) => onChange(cur.id, { can_resize: e.target.checked })} /> Guests can make it bigger or smaller
          </label>
          <label className={styles.check}>
            <input type="checkbox" checked={cur.can_rotate} onChange={(e) => onChange(cur.id, { can_rotate: e.target.checked })} /> Guests can turn it
          </label>
          <Button size="sm" variant="secondary" onClick={() => void remove(cur)}>
            <Trash2 size={15} aria-hidden="true" /> Remove Sticker
          </Button>
        </fieldset>
      )}
      {picking && <PictureDialog title="Sticker" hint="PNG or WebP with a see-through background works best" onUse={addPicture} onClose={() => setPicking(false)} />}
    </div>
  );
}

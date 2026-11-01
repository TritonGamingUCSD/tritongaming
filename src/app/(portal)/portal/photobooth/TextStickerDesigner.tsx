'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import ColorInput from '@/components/ui/ColorInput';
import { Field, Input } from '@/components/ui/Field';
import { showToast } from '@/lib/ui/toast';
import { DEFAULT_TEXT_STICKER, drawTextSticker, renderTextSticker, type TextSticker } from '@/lib/photobooth/design';
import { uploadSticker } from './api';
import styles from './photobooth.module.css';

// Making a sticker out of words on the website (a hashtag, a name, a joke): big outlined letters on an optional plate. It is a page of its own, with a drawing that follows every change, and saves into the sticker library.
export function TextStickerDesigner({ onBack }: { onBack: () => void }) {
  const [s, setS] = useState<TextSticker>(DEFAULT_TEXT_STICKER);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (patch: Partial<TextSticker>) => setS((x) => ({ ...x, ...patch }));
  useEffect(() => {
    if (canvas.current) drawTextSticker(canvas.current, s);
  }, [s]);
  const save = async () => {
    setBusy(true);
    setError('');
    const blob = await renderTextSticker(s);
    if (!blob) {
      setBusy(false);
      return setError('This browser could not make the picture. Try Chrome or Safari.');
    }
    const r = await uploadSticker({ name: s.text.trim().slice(0, 60), blob, sticker: { x: 0.5, y: 0.88, size: 0.7, can_resize: true, can_rotate: true } });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    showToast('Saved to the sticker library');
    onBack();
  };
  return (
    <div className={styles.stack}>
      <div className={styles.toolbar}>
        <Button variant="secondary" size="sm" onClick={onBack}>
          <ArrowLeft size={15} aria-hidden="true" /> Stickers
        </Button>
      </div>
      <h2 className={styles.h2}>Design A Text Sticker</h2>
      <div className={styles.studio}>
        <div className={styles.studioPreview}>
          <div className={styles.designText}>
            <canvas ref={canvas} aria-label="The sticker" />
          </div>
        </div>
        <div className={styles.card}>
          <div className={styles.form}>
            <Field label="Words" hint="A hashtag, a name, a joke">
              <Input value={s.text} maxLength={40} onChange={(e) => set({ text: e.target.value })} />
            </Field>
            <div className={styles.colors}>
              <Field label="Words colour">
                <ColorInput value={s.color} onChange={(e) => set({ color: e.target.value })} aria-label="Words colour" />
              </Field>
              <Field label="Outline colour">
                <ColorInput value={s.outline} onChange={(e) => set({ outline: e.target.value })} aria-label="Outline colour" />
              </Field>
            </div>
            <label className={styles.check}>
              <input type="checkbox" checked={!!s.pill} onChange={(e) => set({ pill: e.target.checked ? '#011941' : '' })} /> A coloured plate behind the words
            </label>
            {s.pill && (
              <Field label="Plate colour">
                <ColorInput value={s.pill} onChange={(e) => set({ pill: e.target.value })} aria-label="Plate colour" />
              </Field>
            )}
            {error && <Notice tone="error">{error}</Notice>}
            <Button loading={busy} disabled={!s.text.trim()} onClick={() => void save()}>
              Save To Library
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

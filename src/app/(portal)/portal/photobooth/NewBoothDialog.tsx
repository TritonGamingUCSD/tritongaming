'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import Dialog from '@/components/ui/Dialog';
import Notice from '@/components/ui/Notice';
import ColorInput from '@/components/ui/ColorInput';
import { Field, Input } from '@/components/ui/Field';
import { PRESETS, findPreset, presetConfig } from '@/lib/photobooth/presets';
import { DEFAULT_FRAME_SPEC, type FrameSpec } from '@/lib/photobooth/booth';
import { renderFrame } from '@/lib/photobooth/design';
import { call, saveFrame } from './api';
import { LayoutPreview } from './LayoutPreview';
import styles from './photobooth.module.css';

// The quick way to a booth: a name, the words for under the photos, a ready-made look and an accent colour. A matching frame (a border in that colour with the words on it) is drawn and added for you, the booth is made, and you
// either open it at once or go on to fine-tune it.
export function NewBoothDialog({ onClose, onMade }: { onClose: () => void; onMade: (slug: string, open: boolean) => void }) {
  const [name, setName] = useState('');
  const [words, setWords] = useState('');
  const [presetId, setPresetId] = useState(PRESETS[0].id);
  const preset = findPreset(presetId);
  const [accent, setAccent] = useState<string | null>(null);
  const colour = accent ?? preset.config.accent ?? '#facc15';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const make = async (open: boolean) => {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError('');
    const r = await call<{ booth: { slug: string } }>('/api/photobooth/booths', 'POST', {
      name: name.trim(),
      config: presetConfig(preset, { footer: words.trim(), accent: colour }),
    });
    if (!r.ok) {
      setBusy(false);
      return setError(r.error);
    }
    // The booth's own frame: this look's border in the accent colour, with the words along the bottom. (If it cannot be drawn the booth is still made, and the frame can be added on its setup page.)
    const spec: FrameSpec = { ...DEFAULT_FRAME_SPEC, border: preset.frame.border, width: preset.frame.width, color: colour, bottom: words.trim().slice(0, 40) };
    const blob = await renderFrame({ ...spec, aspect: preset.config.aspect ?? 'portrait', logo: null });
    if (blob) await saveFrame(r.data.booth.slug, { frame: blob, spec });
    setBusy(false);
    onMade(r.data.booth.slug, open);
  };

  const preview = presetConfig(preset, { footer: words.trim(), accent: colour });
  return (
    <Dialog title="Make A Booth" onClose={onClose} busy={busy}>
      <div className={styles.form}>
        <Field label="Booth name">
          <Input value={name} maxLength={80} autoFocus onChange={(e) => setName(e.target.value)} placeholder="Costume Party booth" />
        </Field>
        <Field label="Words under the photos" hint="The event name, date or hashtag. Optional.">
          <Input value={words} maxLength={40} onChange={(e) => setWords(e.target.value)} placeholder="Costume Party · Oct 31 · #TritonGaming" />
        </Field>
        <div className={styles.looks} role="radiogroup" aria-label="Look">
          {PRESETS.map((p) => (
            <label key={p.id} className={`${styles.choice} ${presetId === p.id ? styles.on : ''}`}>
              <input type="radio" name="look" checked={presetId === p.id} onChange={() => (setPresetId(p.id), setAccent(null))} />
              <span>
                <strong>{p.name}</strong>
                <small>{p.about}</small>
              </span>
            </label>
          ))}
        </div>
        <div className={styles.newPreview}>
          <div className={styles.newPreviewBox}>
            <LayoutPreview config={preview} />
          </div>
          <Field label="Accent colour" hint="The border, the buttons and the countdown message">
            <ColorInput value={colour} onChange={(e) => setAccent(e.target.value)} aria-label="Accent colour" />
          </Field>
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        <div className={styles.rowActions}>
          <Button loading={busy} disabled={!name.trim()} onClick={() => void make(true)}>
            Make It And Open The Booth
          </Button>
          <Button variant="secondary" disabled={!name.trim() || busy} onClick={() => void make(false)}>
            Make It And Fine-Tune
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

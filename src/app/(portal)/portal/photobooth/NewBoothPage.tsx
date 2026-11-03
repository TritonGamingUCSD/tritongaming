'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import DetailHeader from '@/components/ui/DetailHeader';
import Notice from '@/components/ui/Notice';
import ColorInput from '@/components/ui/ColorInput';
import { Field, Input } from '@/components/ui/Field';
import { DEFAULT_FRAME_SPEC, type FrameSpec } from '@/lib/photobooth/booth';
import { renderFrame } from '@/lib/photobooth/design';
import { PRESETS, findPreset, presetConfig, type Preset } from '@/lib/photobooth/presets';
import { call, saveFrame } from './api';
import { LayoutPreview } from './LayoutPreview';
import { useFrameDrawing } from './useFrameDrawing';
import styles from './photobooth.module.css';

const SWATCHES = ['#facc15', '#f472b6', '#38bdf8', '#34d399', '#fb923c', '#a78bfa'];

/** What a look's frame is made of, with the accent colour and the words along the bottom. */
const frameOf = (preset: Preset, colour: string, words: string): FrameSpec => ({
  ...DEFAULT_FRAME_SPEC,
  border: preset.frame.border,
  width: preset.frame.width,
  color: colour,
  bottom: words.trim().slice(0, 40),
});

// The quick way to a booth, on a page of its own: a name, the words for under the photos, a ready-made look and an accent colour, with a big drawing of what guests will get beside it. A matching frame is drawn and
// added for you, the booth is made, and you either open it at once or go on to fine-tune it.
export function NewBoothPage({ onBack, onMade }: { onBack: () => void; onMade: (slug: string, open: boolean) => void }) {
  const [name, setName] = useState('');
  const [words, setWords] = useState('');
  const [presetId, setPresetId] = useState(PRESETS[0].id);
  const preset = findPreset(presetId);
  const [accent, setAccent] = useState<string | null>(null);
  const colour = accent ?? preset.config.accent ?? '#facc15';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const preview = presetConfig(preset, { footer: words.trim(), accent: colour });
  const drawing = useFrameDrawing(frameOf(preset, colour, words), preview.aspect, '');

  const make = async (open: boolean) => {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError('');
    const r = await call<{ booth: { slug: string }; look: string | null }>('/api/photobooth/booths', 'POST', { name: name.trim(), config: preview });
    if (!r.ok) {
      setBusy(false);
      return setError(r.error);
    }
    // (If the frame cannot be drawn or saved the booth is still made, and the frame can be added on its setup page.)
    const spec = frameOf(preset, colour, words);
    const blob = await renderFrame({ ...spec, aspect: preview.aspect, logo: null });
    if (blob && r.data.look) await saveFrame(r.data.look, { frame: blob, spec });
    setBusy(false);
    onMade(r.data.booth.slug, open);
  };

  return (
    <div className={styles.stack}>
      <DetailHeader back={{ label: 'All Booths', onClick: onBack }} title="Make A Booth" />
      <div className={styles.studio}>
        <div className={styles.studioPreview}>
          <div className={styles.bigPreview}>
            <LayoutPreview config={preview} frameUrl={drawing || undefined} />
          </div>
          <p className={styles.meta}>What each guest gets</p>
        </div>
        <div className={styles.stack}>
          <section className={styles.card} aria-labelledby="nb-name">
            <h3 id="nb-name">1. Name It</h3>
            <Field label="Booth name">
              <Input value={name} maxLength={80} autoFocus onChange={(e) => setName(e.target.value)} placeholder="Costume Party booth" />
            </Field>
            <Field label="Words under the photos" hint="The event name, date or hashtag. Optional.">
              <Input value={words} maxLength={40} onChange={(e) => setWords(e.target.value)} placeholder="Costume Party · Oct 31 · #TritonGaming" />
            </Field>
          </section>
          <section className={styles.card} aria-labelledby="nb-look">
            <h3 id="nb-look">2. Pick A Look</h3>
            <div className={styles.looks} role="radiogroup" aria-label="Look">
              {PRESETS.map((p) => (
                <label key={p.id} className={`${styles.look} ${presetId === p.id ? styles.on : ''}`}>
                  <input
                    type="radio"
                    name="look"
                    checked={presetId === p.id}
                    onChange={() => {
                      setPresetId(p.id);
                      setAccent(null);
                    }}
                  />
                  <span className={styles.lookThumb}>
                    <LayoutPreview config={presetConfig(p, { accent: p.config.accent })} />
                  </span>
                  <span>
                    <strong>{p.name}</strong>
                    <small>{p.about}</small>
                  </span>
                </label>
              ))}
            </div>
          </section>
          <section className={styles.card} aria-labelledby="nb-colour">
            <h3 id="nb-colour">3. Pick A Colour</h3>
            <div className={styles.swatches} role="radiogroup" aria-label="Accent colour">
              {SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={colour.toLowerCase() === c}
                  aria-label={`Colour ${c}`}
                  className={`${styles.swatch} ${colour.toLowerCase() === c ? styles.swatchOn : ''}`}
                  style={{ background: c }}
                  onClick={() => setAccent(c)}
                />
              ))}
              <ColorInput value={colour} onChange={(e) => setAccent(e.target.value)} aria-label="Accent colour" />
            </div>
            <p className={styles.about}>It colours the border of the frame, the buttons and the message before each shot. You can change everything later.</p>
          </section>
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
      </div>
    </div>
  );
}

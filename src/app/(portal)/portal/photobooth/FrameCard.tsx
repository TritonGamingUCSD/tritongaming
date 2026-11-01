'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import PictureDialog from '@/components/ui/PictureDialog';
import ColorInput from '@/components/ui/ColorInput';
import NumberInput from '@/components/ui/NumberInput';
import { Field, Input } from '@/components/ui/Field';
import {
  BORDERS,
  BORDER_NAMES,
  DEFAULT_FRAME_SPEC,
  LOGO_SPOTS,
  LOGO_SPOT_NAMES,
  cellRatio,
  type Aspect,
  type BorderStyle,
  type FrameSpec,
  type LogoSpot,
} from '@/lib/photobooth/booth';
import { shrinkOverlay } from '@/lib/photobooth/shrink';
import styles from './photobooth.module.css';

// The booth's own frame, drawn over each photo, made right on its setup page (no picture of an exact shape needed): a border, words at the top and the bottom, a logo. A drawing of it follows every change.
export function FrameCard({
  spec,
  accent,
  aspect,
  drawing,
  onChange,
  onLogo,
}: {
  spec: FrameSpec | null;
  accent: string;
  aspect: Aspect;
  drawing: string;
  onChange: (spec: FrameSpec | null) => void;
  onLogo: (logo: { blob: Blob; url: string } | null) => void;
}) {
  const [picking, setPicking] = useState(false);
  const [problem, setProblem] = useState('');
  const set = (patch: Partial<FrameSpec>) => spec && onChange({ ...spec, ...patch });

  const chooseLogo = async (files: File[]) => {
    const f = files[0];
    setPicking(false);
    if (!f) return;
    const blob = await shrinkOverlay(f);
    if (!blob) return setProblem('That logo couldn’t be made small enough. Try a simpler or smaller picture.');
    setProblem('');
    const url = URL.createObjectURL(blob);
    onLogo({ blob, url });
    set({ logoUrl: url });
  };

  return (
    <section className={styles.card} aria-labelledby="pb-frame">
      <h3 id="pb-frame">Frame</h3>
      <label className={styles.check}>
        <input type="checkbox" checked={!!spec} onChange={(e) => onChange(e.target.checked ? { ...DEFAULT_FRAME_SPEC, color: accent, bottom: '' } : null)} /> Draw a frame over
        every photo
      </label>
      {spec && (
        <div className={styles.frameGrid}>
          <div className={styles.frameDrawing} style={{ aspectRatio: String(cellRatio(aspect)) }} aria-hidden="true">
            {drawing && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={drawing} alt="" />
            )}
          </div>
          <div className={styles.form}>
            <div className={styles.fields}>
              <Field label="Border">
                <select className={styles.select} value={spec.border} onChange={(e) => set({ border: e.target.value as BorderStyle })}>
                  {BORDERS.map((b) => (
                    <option key={b} value={b}>
                      {BORDER_NAMES[b]}
                    </option>
                  ))}
                </select>
              </Field>
              {spec.border !== 'none' && (
                <>
                  <Field label="Border colour">
                    <ColorInput value={spec.color} onChange={(e) => set({ color: e.target.value })} aria-label="Border colour" />
                  </Field>
                  <Field label="Border thickness">
                    <NumberInput min={4} max={60} value={spec.width} onChange={(e) => set({ width: Number(e.target.value) })} />
                  </Field>
                </>
              )}
            </div>
            <div className={styles.fields}>
              <Field label="Words at the top" hint="The event name, for example">
                <Input value={spec.top} maxLength={40} onChange={(e) => set({ top: e.target.value })} />
              </Field>
              <Field label="Words at the bottom" hint="A date or hashtag">
                <Input value={spec.bottom} maxLength={40} onChange={(e) => set({ bottom: e.target.value })} />
              </Field>
            </div>
            {(spec.top.trim() || spec.bottom.trim()) && (
              <div className={styles.colors}>
                <Field label="Behind the words">
                  <ColorInput value={spec.band} onChange={(e) => set({ band: e.target.value })} aria-label="Colour behind the words" />
                </Field>
                <Field label="Words colour">
                  <ColorInput value={spec.text} onChange={(e) => set({ text: e.target.value })} aria-label="Words colour" />
                </Field>
              </div>
            )}
            <div className={styles.fields}>
              <Field label="Logo">
                <div className={styles.rowActions}>
                  <Button size="sm" variant="secondary" onClick={() => setPicking(true)}>
                    {spec.logoUrl ? 'Change Logo' : 'Add A Logo'}
                  </Button>
                  {spec.logoUrl && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        onLogo(null);
                        set({ logoUrl: '' });
                      }}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </Field>
              {spec.logoUrl && (
                <>
                  <Field label="Where">
                    <select className={styles.select} value={spec.logoSpot} onChange={(e) => set({ logoSpot: e.target.value as LogoSpot })}>
                      {LOGO_SPOTS.map((s) => (
                        <option key={s} value={s}>
                          {LOGO_SPOT_NAMES[s]}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <label className={styles.slider}>
                    <span>Logo size</span>
                    <input type="range" min={0.08} max={0.5} step={0.01} value={spec.logoSize} onChange={(e) => set({ logoSize: Number(e.target.value) })} />
                  </label>
                </>
              )}
            </div>
            {problem && <Notice tone="error">{problem}</Notice>}
          </div>
        </div>
      )}
      {picking && <PictureDialog title="Logo" hint="PNG or WebP with a see-through background works best" onUse={chooseLogo} onClose={() => setPicking(false)} />}
    </section>
  );
}

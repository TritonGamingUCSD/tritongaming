'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import PictureDialog from '@/components/ui/PictureDialog';
import ColorInput from '@/components/ui/ColorInput';
import NumberInput from '@/components/ui/NumberInput';
import { Field, Input } from '@/components/ui/Field';
import { BORDERS, BORDER_NAMES, DEFAULT_FRAME_SPEC, LOGO_SPOTS, LOGO_SPOT_AT, LOGO_SPOT_NAMES, type FrameSpec } from '@/lib/photobooth/booth';
import { FRAME_PRESETS } from '@/lib/photobooth/presets';
import { shrinkOverlay } from '@/lib/photobooth/shrink';
import type { Selection } from './StudioCanvas';
import styles from './photobooth.module.css';

// The frame tool: the border, the words at the top and the bottom and a logo. Everything here can also be done on the picture itself (drag the logo or the words, pull a corner); these are for exact values.
export function FramePanel({
  spec,
  accent,
  boothName,
  selected,
  onChange,
  onLogo,
}: {
  spec: FrameSpec | null;
  accent: string;
  boothName: string;
  selected: Selection;
  onChange: (patch: Partial<FrameSpec> | null, key?: string) => void;
  /** A logo the person picked: its small file and a temporary address to show it from. */
  onLogo: (logo: { blob: Blob; url: string }) => void;
}) {
  const [picking, setPicking] = useState(false);
  const [problem, setProblem] = useState('');
  const chooseLogo = async (files: File[]) => {
    const f = files[0];
    setPicking(false);
    if (!f) return;
    const blob = await shrinkOverlay(f);
    if (!blob) return setProblem('That logo couldn’t be made small enough. Try a simpler or smaller picture.');
    setProblem('');
    const url = URL.createObjectURL(blob);
    onLogo({ blob, url });
    onChange({ logoUrl: url });
  };
  const on = (kind: string) => (selected?.kind === kind ? styles.groupOn : '');

  return (
    <div className={styles.tools}>
      <label className={styles.check}>
        <input type="checkbox" checked={!!spec} onChange={(e) => onChange(e.target.checked ? { ...DEFAULT_FRAME_SPEC, color: accent } : null)} /> Draw a frame over every photo
      </label>
      <fieldset className={styles.group}>
        <legend>Start From A Preset</legend>
        <div className={styles.segment}>
          {FRAME_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onChange({ ...(spec ?? { ...DEFAULT_FRAME_SPEC, color: accent }), ...p.make({ name: boothName, accent }) }, `preset-${p.id}`)}
            >
              {p.name}
            </button>
          ))}
        </div>
        <p className={styles.hint}>Changes the border and words. Your logo stays. Undo brings the old frame back.</p>
      </fieldset>
      {spec && (
        <>
          <fieldset className={`${styles.group} ${on('frame')}`}>
            <legend>Border</legend>
            <div className={styles.segment} role="radiogroup" aria-label="Border">
              {BORDERS.map((b) => (
                <button
                  key={b}
                  type="button"
                  role="radio"
                  aria-checked={spec.border === b}
                  className={spec.border === b ? styles.segOn : ''}
                  onClick={() => onChange({ border: b })}
                >
                  {BORDER_NAMES[b]}
                </button>
              ))}
            </div>
            {spec.border !== 'none' && (
              <div className={styles.pair}>
                <Field label="Colour">
                  <ColorInput value={spec.color} onChange={(e) => onChange({ color: e.target.value }, 'border-colour')} aria-label="Border colour" />
                </Field>
                <Field label="Thickness">
                  <NumberInput min={4} max={60} value={spec.width} onChange={(e) => onChange({ width: Number(e.target.value) }, 'border-width')} />
                </Field>
              </div>
            )}
          </fieldset>
          <fieldset className={`${styles.group} ${on('top')} ${on('bottom')}`}>
            <legend>Words</legend>
            <Field label="At the top" hint="The event name, for example">
              <Input value={spec.top} maxLength={40} onChange={(e) => onChange({ top: e.target.value }, 'top')} />
            </Field>
            <Field label="At the bottom" hint="A date or hashtag">
              <Input value={spec.bottom} maxLength={40} onChange={(e) => onChange({ bottom: e.target.value }, 'bottom')} />
            </Field>
            {(spec.top.trim() || spec.bottom.trim()) && (
              <>
                <div className={styles.pair}>
                  <Field label="Behind the words">
                    <ColorInput value={spec.band} onChange={(e) => onChange({ band: e.target.value }, 'band')} aria-label="Colour behind the words" />
                  </Field>
                  <Field label="Words colour">
                    <ColorInput value={spec.text} onChange={(e) => onChange({ text: e.target.value }, 'text')} aria-label="Words colour" />
                  </Field>
                </div>
                <label className={styles.slider}>
                  <span>Size</span>
                  <input type="range" min={0.04} max={0.2} step={0.005} value={spec.wordsSize} onChange={(e) => onChange({ wordsSize: Number(e.target.value) }, 'words-size')} />
                </label>
                <p className={styles.hint}>Drag the words on the picture to move them.</p>
              </>
            )}
          </fieldset>
          <fieldset className={`${styles.group} ${on('logo')}`}>
            <legend>Logo</legend>
            <div className={styles.rowActions}>
              <Button size="sm" variant="secondary" onClick={() => setPicking(true)}>
                {spec.logoUrl ? 'Change Logo' : 'Add A Logo'}
              </Button>
              {spec.logoUrl && (
                <Button size="sm" variant="secondary" onClick={() => onChange({ logoUrl: '' })}>
                  Remove
                </Button>
              )}
            </div>
            {spec.logoUrl && (
              <>
                <label className={styles.slider}>
                  <span>Size</span>
                  <input type="range" min={0.08} max={0.5} step={0.01} value={spec.logoSize} onChange={(e) => onChange({ logoSize: Number(e.target.value) }, 'logo-size')} />
                </label>
                <div className={styles.segment} role="group" aria-label="Snap the logo to">
                  {LOGO_SPOTS.map((s) => (
                    <button key={s} type="button" onClick={() => onChange({ logoX: LOGO_SPOT_AT[s].x, logoY: LOGO_SPOT_AT[s].y })}>
                      {LOGO_SPOT_NAMES[s]}
                    </button>
                  ))}
                </div>
                <p className={styles.hint}>Drag the logo on the picture to move it; pull its corner to resize.</p>
              </>
            )}
            {problem && <Notice tone="error">{problem}</Notice>}
          </fieldset>
        </>
      )}
      {picking && <PictureDialog title="Logo" hint="PNG or WebP with a see-through background works best" onUse={chooseLogo} onClose={() => setPicking(false)} />}
    </div>
  );
}

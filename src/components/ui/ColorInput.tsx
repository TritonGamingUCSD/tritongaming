'use client';

import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import Popover from './Popover';
import styles from './ColorInput.module.css';

// A color picker drawn by us (the native one is a different, often clunky, window on every platform):
// a swatch + hex value that opens a palette of the club's colors and a hex field. Value is '#rrggbb';
// onChange(e) gets e.target.value like the native input.
const PALETTE = ['#ffc72c', '#f97316', '#ef4444', '#de4188', '#a855f7', '#6366f1', '#4a90e2', '#22d3ee', '#34d399', '#84cc16', '#e5e7eb', '#6b7280'];
const HEX = /^#[0-9a-fA-F]{6}$/;

export default function ColorInput({ value, onChange, className = '', disabled, 'aria-label': ariaLabel }: { value: string; onChange?: (e: ChangeEvent<HTMLInputElement>) => void; className?: string; disabled?: boolean; 'aria-label'?: string }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLButtonElement>(null);
  const emit = (v: string) => onChange?.({ target: { value: v }, currentTarget: { value: v } } as unknown as ChangeEvent<HTMLInputElement>);
  return (
    <>
      <button ref={ref} type="button" className={`${styles.trigger} ${className}`} disabled={disabled} aria-haspopup="dialog" aria-expanded={open} aria-label={ariaLabel ?? `Color ${value}`} onClick={() => { setDraft(value); setOpen((o) => !o); }}>
        <span className={styles.swatch} style={{ background: value }} />
        <span className={styles.hex}>{value.toUpperCase()}</span>
      </button>
      {open && (
        <Popover anchor={ref} onClose={() => setOpen(false)} width={236} label="Choose a color">
          <div className={styles.palette}>
            {PALETTE.map((c) => <button key={c} type="button" className={`${styles.chip} ${c.toLowerCase() === value.toLowerCase() ? styles.chipOn : ''}`} style={{ background: c }} aria-label={c} onClick={() => { emit(c); setOpen(false); }} />)}
          </div>
          <label className={styles.custom}>
            <span>Hex</span>
            <input value={draft} maxLength={7} spellCheck={false} onChange={(e) => { const v = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`; setDraft(v); if (HEX.test(v)) emit(v); }} />
          </label>
        </Popover>
      )}
    </>
  );
}

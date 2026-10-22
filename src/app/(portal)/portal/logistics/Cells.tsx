'use client';

import { useState } from 'react';
import styles from './logistics.module.css';

// Table cells that are their own boxes: change the value and leave the cell (or press Enter) and it is saved; Escape puts the old value back. Used in the lists that are edited in place.

export function TextCell({ value, onSave, label, placeholder, disabled, maxLength = 200 }: { value: string; onSave: (v: string) => void; label: string; placeholder?: string; disabled?: boolean; maxLength?: number }) {
  const [text, setText] = useState<string | null>(null);
  return (
    <input className={styles.cellInput} value={text ?? value} placeholder={placeholder} disabled={disabled} aria-label={label} maxLength={maxLength}
      onChange={(e) => setText(e.target.value)} onBlur={() => { if (text !== null && text.trim() !== value) onSave(text.trim()); setText(null); }}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); else if (e.key === 'Escape') setText(null); }} />
  );
}

export function NumberCell({ value, onSave, label, disabled, step = 1, money, min = 0 }: { value: number | null; onSave: (v: number | null) => void; label: string; disabled?: boolean; step?: number; money?: boolean; min?: number }) {
  const [text, setText] = useState<string | null>(null);
  const shown = text ?? (value === null ? '' : String(value));
  return (
    <span className={styles.numWrap}>
      {money && <i aria-hidden="true">$</i>}
      <input className={`${styles.cellInput} ${styles.cellNum}`} type="number" inputMode={money ? 'decimal' : 'numeric'} min={min} step={step} value={shown} disabled={disabled} aria-label={label}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => { if (text !== null) { const n = text.trim() === '' ? null : Number(text); if (n === null ? value !== null : Number.isFinite(n) && n !== value) onSave(n); setText(null); } }}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); else if (e.key === 'Escape') setText(null); }} />
    </span>
  );
}

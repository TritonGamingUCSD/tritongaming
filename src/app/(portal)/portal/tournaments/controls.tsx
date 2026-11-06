'use client';

import { Minus, Plus } from 'lucide-react';
import styles from './controls.module.css';

// Small controls for setting up a tournament: each shows its choices at once instead of hiding them in a menu, so the options can be understood without opening anything.
export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
  disabled,
}: {
  value: T;
  options: { value: T; label: string; hint?: string }[];
  onChange: (v: T) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <div className={styles.segmented} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          title={o.hint}
          disabled={disabled}
          className={`${styles.seg} ${o.value === value ? styles.segOn : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Stepper({
  value,
  min = 1,
  max = 99,
  onChange,
  label,
  suffix,
  disabled,
}: {
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
  label: string;
  suffix?: string;
  disabled?: boolean;
}) {
  return (
    <div className={styles.stepper} role="group" aria-label={label}>
      <button type="button" aria-label={`Fewer ${label}`} disabled={disabled || value <= min} onClick={() => onChange(Math.max(min, value - 1))}>
        <Minus size={14} aria-hidden="true" />
      </button>
      <output aria-live="polite">
        <b>{value}</b>
        {suffix && <small> {suffix}</small>}
      </output>
      <button type="button" aria-label={`More ${label}`} disabled={disabled || value >= max} onClick={() => onChange(Math.min(max, value + 1))}>
        <Plus size={14} aria-hidden="true" />
      </button>
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  children,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <label className={`${styles.toggle} ${disabled ? styles.off : ''}`} title={hint}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className={styles.track} aria-hidden="true" />
      <span>{children}</span>
    </label>
  );
}

'use client';

import { useRef } from 'react';
import type { InputHTMLAttributes } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import styles from './NumberInput.module.css';

// A number field with our own − / + steppers. The native up/down arrows look different (or are missing)
// on every browser and phone, so they're hidden (see globals.css) and these take their place. It is still
// a real <input type="number">, so min/max/step, validation, typing and onChange work as usual.
export default function NumberInput({ className = '', disabled, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const ref = useRef<HTMLInputElement>(null);
  function bump(dir: 1 | -1) {
    const el = ref.current;
    if (!el || disabled) return;
    if (dir > 0) el.stepUp(); else el.stepDown();
    el.dispatchEvent(new Event('input', { bubbles: true }));   // lets React's onChange see the new value
  }
  return (
    <span className={styles.wrap}>
      <input ref={ref} type="number" inputMode="decimal" disabled={disabled} className={`${styles.input} ${className}`} {...rest} />
      <span className={styles.steppers}>
        <button type="button" tabIndex={-1} className={styles.step} onClick={() => bump(1)} disabled={disabled} aria-label="Increase"><ChevronUp size={12} strokeWidth={2.5} aria-hidden="true" /></button>
        <button type="button" tabIndex={-1} className={styles.step} onClick={() => bump(-1)} disabled={disabled} aria-label="Decrease"><ChevronDown size={12} strokeWidth={2.5} aria-hidden="true" /></button>
      </span>
    </span>
  );
}

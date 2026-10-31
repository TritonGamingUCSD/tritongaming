'use client';

import { Check, Minus } from 'lucide-react';
import styles from './meetings.module.css';

export function CheckTile({ checked, indeterminate, label, onChange }: { checked: boolean; indeterminate?: boolean; label: string; onChange: () => void }) {
  return (
    <label className={`${styles.check} ${checked || indeterminate ? styles.checkOn : ''}`}>
      <input type="checkbox" className={styles.checkInput} checked={checked} onChange={onChange} />
      <span className={styles.checkBox} aria-hidden="true">
        {indeterminate ? <Minus size={13} strokeWidth={3} /> : checked ? <Check size={13} strokeWidth={3} /> : null}
      </span>
      <span>{label}</span>
    </label>
  );
}

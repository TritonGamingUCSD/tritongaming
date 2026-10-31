'use client';

import { Select } from '@/components/ui/Field';
import styles from './tracker.module.css';
import { CATEGORIES } from './format';

export function CategorySelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select className={styles.select} value={value} onChange={(e) => onChange(e.target.value)} aria-label="What kind of strike">
      {CATEGORIES.map(([id, label]) => (
        <option key={id} value={id}>
          {label}
        </option>
      ))}
    </Select>
  );
}

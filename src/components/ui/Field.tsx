import type { InputHTMLAttributes, TextareaHTMLAttributes, ReactNode } from 'react';
import CustomSelect from './Select';
import { DateInput as RawDate, TimeInput as RawTime, DateTimeInput as RawDateTime } from './DateTime';
import styles from './Field.module.css';

// Shared text controls so every form gets the same padding, border, focus ring
// and mobile sizing (16px on phones so iOS doesn't zoom on focus).
export function Input({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${styles.control} ${className}`} {...rest} />;
}

export function Textarea({ className = '', ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${styles.control} ${styles.textarea} ${className}`} {...rest} />;
}

// The custom dropdown (see Select.tsx), with the standard field look.
export function Select({ className = '', ...rest }: React.ComponentProps<typeof CustomSelect>) {
  return <CustomSelect className={`${styles.control} ${className}`} {...rest} />;
}

// Label + control + optional hint, stacked.
export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      {children}
      {hint && <span className={styles.hint}>{hint}</span>}
    </label>
  );
}

// Date / time pickers with the standard field look (see DateTime.tsx).
export function DateInput({ className = '', ...rest }: React.ComponentProps<typeof RawDate>) { return <RawDate className={`${styles.control} ${className}`} {...rest} />; }
export function TimeInput({ className = '', ...rest }: React.ComponentProps<typeof RawTime>) { return <RawTime className={`${styles.control} ${className}`} {...rest} />; }
export function DateTimeInput({ className = '', ...rest }: React.ComponentProps<typeof RawDateTime>) { return <RawDateTime className={`${styles.control} ${className}`} {...rest} />; }

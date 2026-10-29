'use client';

import { useState } from 'react';
import styles from './CodeEntry.module.css';

// The one box for a six-digit code, whatever it is for (a meeting's code, or a ticket's). It sends itself as soon as the sixth digit is in.
export default function CodeEntry({
  onSubmit,
  busy,
  autoFocus = false,
  dark = false,
}: {
  onSubmit: (code: string) => void;
  busy?: boolean;
  autoFocus?: boolean;
  /** On the camera screen: light text on a dark glass. */ dark?: boolean;
}) {
  const [value, setValue] = useState('');
  return (
    <input
      className={`${styles.box} ${dark ? styles.dark : ''}`}
      value={value}
      onChange={(e) => {
        const v = e.target.value.replace(/\D/g, '').slice(0, 6);
        setValue(v);
        if (v.length === 6) {
          onSubmit(v);
          setValue('');
        }
      }}
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="[0-9]*"
      maxLength={6}
      placeholder="000000"
      aria-label="6-digit code"
      disabled={busy}
      autoFocus={autoFocus}
    />
  );
}

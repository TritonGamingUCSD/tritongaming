'use client';

import { useState } from 'react';
import styles from './CodeEntry.module.css';

// The one box for a six-digit code, whatever it is for (a meeting's code, a ticket's, a Trivia game's, a poll's). It sends itself as soon as the sixth digit is in.
// The box always shows six places: the zeros are only placeholders and each typed digit replaces the next one, with a caret on the place being filled. A real (invisible) input underneath takes the typing, so the number keypad, paste and
// autofill all still work.
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
  const [focused, setFocused] = useState(false);
  return (
    <div className={`${styles.wrap} ${dark ? styles.dark : ''}`}>
      <input
        className={`${styles.box} ${dark ? styles.darkBox : ''}`}
        value={value}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, '').slice(0, 6);
          setValue(v);
          if (v.length === 6) {
            onSubmit(v);
            setValue('');
          }
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={6}
        aria-label="6-digit code"
        disabled={busy}
        autoFocus={autoFocus}
      />
      <span className={styles.cells} aria-hidden="true">
        {Array.from({ length: 6 }, (_, i) => (
          <span key={i} className={`${styles.cell} ${i < value.length ? styles.filled : ''} ${focused && i === value.length ? styles.next : ''}`}>
            {value[i] ?? '0'}
          </span>
        ))}
      </span>
    </div>
  );
}

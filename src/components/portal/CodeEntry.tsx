'use client';

import { useState, type ReactNode } from 'react';
import styles from './CodeEntry.module.css';

// The one box for a six-digit code, whatever it is for (a meeting's code, a ticket's, a Trivia game's, a poll's). It sends itself as soon as the sixth digit is in.
// The box always shows six places: the zeros are only placeholders and each typed digit replaces the next one, with a caret on the place being filled. A real (invisible) input underneath takes the typing, so the number keypad, paste and
// autofill all still work.
export default function CodeEntry({
  onSubmit,
  busy,
  autoFocus = false,
  dark = false,
  compact = false,
  icon,
  status = null,
}: {
  onSubmit: (code: string) => void;
  busy?: boolean;
  autoFocus?: boolean;
  /** On the camera screen: light text on a dark glass. */ dark?: boolean;
  /** Small, for the sidebar. */ compact?: boolean;
  /** A small mark inside the box at the left, in place of a label above it. */ icon?: ReactNode;
  /** How the last code went: a flash for 'ok', a shake for 'bad'. */ status?: 'ok' | 'bad' | null;
}) {
  const [value, setValue] = useState('');
  // The six digits just sent stay on screen (with a wave over them) while the code is being checked, then the box empties.
  const [sent, setSent] = useState('');
  const [focused, setFocused] = useState(false);
  return (
    <div
      className={`${styles.wrap} ${dark ? styles.dark : ''} ${compact ? styles.compact : ''} ${status === 'ok' ? styles.ok : ''} ${status === 'bad' ? styles.bad : ''} ${busy ? styles.busy : ''}`}
    >
      <input
        className={`${styles.box} ${dark ? styles.darkBox : ''}`}
        value={value}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, '').slice(0, 6);
          setValue(v);
          if (v.length === 6) {
            setSent(v);
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
      {icon && (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      )}
      <span className={styles.cells} aria-hidden="true">
        {Array.from({ length: 6 }, (_, i) => {
          const shown = busy ? sent : value;
          return (
            <span
              key={i}
              style={{ ['--i' as string]: i }}
              className={`${styles.cell} ${i < shown.length ? styles.filled : ''} ${!busy && focused && i === value.length ? styles.next : ''}`}
            >
              {shown[i] ?? '0'}
            </span>
          );
        })}
      </span>
    </div>
  );
}

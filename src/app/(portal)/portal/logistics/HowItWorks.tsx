'use client';

import { useEffect, useState, type ReactNode } from 'react';
import styles from './logistics.module.css';

// A short plain-language "how this works" that people can open and close; whether it is open is remembered on this device. `startOpen` is for the first time (an empty page).
export default function HowItWorks({
  id,
  title = 'How this works',
  startOpen = false,
  compact = false,
  children,
}: {
  id: string;
  title?: string;
  startOpen?: boolean;
  compact?: boolean;
  children: ReactNode;
}) {
  const key = `tg-logi-help-${id}`;
  const [open, setOpen] = useState(startOpen);
  useEffect(() => {
    try {
      const v = localStorage.getItem(key);
      if (v === '1') setOpen(true);
      else if (v === '0') setOpen(false);
    } catch {
      /* fine without it */
    }
  }, [key]);
  const toggle = (next: boolean) => {
    setOpen(next);
    try {
      localStorage.setItem(key, next ? '1' : '0');
    } catch {
      /* fine without it */
    }
  };
  return (
    <details
      className={`${styles.help} ${compact ? styles.helpCompact : ''}`}
      open={open}
      onToggle={(e) => {
        const o = (e.currentTarget as HTMLDetailsElement).open;
        if (o !== open) toggle(o);
      }}
    >
      <summary>{title}</summary>
      <div className={styles.helpBody}>{children}</div>
    </details>
  );
}

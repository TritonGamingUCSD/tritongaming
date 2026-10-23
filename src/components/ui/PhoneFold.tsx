import type { ReactNode } from 'react';
import styles from './PhoneFold.module.css';

// Long help text: shown in full on a laptop, and on a phone folded behind a small "learn more" line so it doesn't push the page down.
export default function PhoneFold({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <div className={styles.full}>{children}</div>
      <details className={styles.fold}>
        <summary>{label}</summary>
        <div className={styles.body}>{children}</div>
      </details>
    </>
  );
}

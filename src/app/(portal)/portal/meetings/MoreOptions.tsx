'use client';

import styles from './meetings.module.css';

// The less common settings fold away; the line says which of them are filled in, so a host sees what is set without opening it.
export function MoreOptions({ filled, children }: { filled: string[]; children: React.ReactNode }) {
  return (
    <details className={styles.moreOptions}>
      <summary>
        <span>More Options</span>
        <em>{filled.length ? filled.join(' · ') : 'Room, doc, question'}</em>
      </summary>
      <div className={styles.moreBody}>{children}</div>
    </details>
  );
}

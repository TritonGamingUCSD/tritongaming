import type { ReactNode } from 'react';
import styles from './EmptyState.module.css';

// What a list says when it has nothing yet: a short line on what it is for, and the one action that starts it. The same look on every page.
export default function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className={styles.box}>
      {icon && (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      )}
      <h2 className={styles.title}>{title}</h2>
      {children && <p className={styles.text}>{children}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}

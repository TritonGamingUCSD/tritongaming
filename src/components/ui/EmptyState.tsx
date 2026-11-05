import type { ReactNode } from 'react';
import ByteMini from '@/components/Bytecode/ByteMini';
import styles from './EmptyState.module.css';

// What a list says when it has nothing yet: Byte (asleep), a short line on what it is for, and the one action that starts it. The same look on every page, so the page's own icon is not needed (`icon` is accepted for old callers and not drawn).
export default function EmptyState({ title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className={styles.box}>
      <span className={styles.byte} aria-hidden="true">
        <ByteMini pose="sleep" />
      </span>
      <h2 className={styles.title}>{title}</h2>
      {children && <p className={styles.text}>{children}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}

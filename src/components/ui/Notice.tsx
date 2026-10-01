import type { ReactNode } from 'react';
import { CircleAlert, TriangleAlert, Info, CircleCheck } from 'lucide-react';
import styles from './Notice.module.css';

// The one inline message style for the whole site/portal — errors, warnings,
// info and success all look the same everywhere instead of each page rolling its
// own red text or yellow box. `onLight` is for use inside white dialogs/sheets
// (the default is tuned for the dark pages).
export type NoticeTone = 'error' | 'warning' | 'info' | 'success';

const ICONS = { error: CircleAlert, warning: TriangleAlert, info: Info, success: CircleCheck } as const;

export default function Notice({
  tone = 'info', onLight = false, compact = false, className = '', children,
}: {
  tone?: NoticeTone;
  onLight?: boolean;
  compact?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const Icon = ICONS[tone];
  return (
    <div
      className={`${styles.notice} ${styles[tone]} ${onLight ? styles.onLight : ''} ${compact ? styles.compact : ''} ${className}`}
      role={tone === 'error' || tone === 'warning' ? 'alert' : 'status'}
    >
      <Icon size={compact ? 14 : 16} strokeWidth={2} aria-hidden="true" className={styles.icon} />
      <div className={styles.body}>{children}</div>
    </div>
  );
}

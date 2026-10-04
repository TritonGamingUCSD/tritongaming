import type { ReactNode } from 'react';
import styles from './SectionHeader.module.css';

// The top of every portal section: the title, one readable line under it, and the section's main action(s) on the right
// (they drop below the title on a phone). The tab bar (SectionTabs) goes directly underneath.
//
// `flush`: the page this sits in already spaces its children (a flex column with a gap), so the header adds no space of its own below.
// Without it the header leaves 1.25rem under itself. On desktop the top bar already names the section, so a header with no actions is hidden entirely.
export default function SectionHeader({ title, sub, actions, flush }: { title: string; sub?: ReactNode; actions?: ReactNode; flush?: boolean }) {
  return (
    <div className={`${styles.header} ${flush ? styles.flush : ''} ${actions ? '' : styles.bare}`}>
      <div className={styles.text}>
        <h1 className={styles.title}>{title}</h1>
        {sub && <p className={styles.sub}>{sub}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}

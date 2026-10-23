import type { ReactNode } from 'react';
import PhoneFold from './PhoneFold';
import styles from './SectionHeader.module.css';

// The top of every portal section: the title, one readable line under it, and the section's main action(s) on the right
// (they drop below the title on a phone). The tab bar (SectionTabs) goes directly underneath, always in the same place.
//
// `foldOnPhone`: the sentence under the title is left out on a phone; with this label it comes back folded behind a small button (for text people need, like a privacy rule).
// `flush`: the page this sits in already spaces its children (a flex column with a gap), so the header adds no space of its own below.
// Without it the header leaves space under itself.
export default function SectionHeader({ title, sub, actions, flush, foldOnPhone }: { title: string; sub?: ReactNode; actions?: ReactNode; flush?: boolean; foldOnPhone?: string }) {
  return (
    <div data-section-header className={`${styles.header} ${flush ? styles.flush : ''}`}>
      <div className={styles.text}>
        <h1 className={styles.title}>{title}</h1>
        {sub && <p className={styles.sub}>{sub}</p>}
        {sub && foldOnPhone && <div className={styles.phoneFold}><PhoneFold label={foldOnPhone}>{sub}</PhoneFold></div>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}

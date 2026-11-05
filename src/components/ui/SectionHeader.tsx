'use client';

import { useSyncExternalStore, type ReactNode } from 'react';
import PhoneFold from './PhoneFold';
import styles from './SectionHeader.module.css';

// The name of the open tab in the strip under the top bar (null when the page has no tabs there). Read from the strip itself, so a page does not have to pass it down.
function subscribeTopTab(cb: () => void) {
  const strip = document.querySelector('[data-top-tabs]');
  if (!strip) return () => {};
  const mo = new MutationObserver(cb);
  mo.observe(strip, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-selected'] });
  return () => mo.disconnect();
}
const topTab = () => document.querySelector('[data-top-tabs] [aria-selected="true"]')?.textContent?.trim() || null;

// The top of every portal section: the title, one readable line under it, and the section's main action(s) on the right
// (they drop below the title on a phone). The tab bar (SectionTabs) goes directly underneath, always in the same place.
//
// When the page has tabs in the strip under the top bar, the big title is the OPEN TAB's name and the section name becomes a small line above it, so the title always says what you are looking at.
// `foldOnPhone`: the sentence under the title is left out on a phone; with this label it comes back folded behind a small button (for text people need, like a privacy rule).
// `flush`: the page this sits in already spaces its children (a flex column with a gap), so the header adds no space of its own below.
// Without it the header leaves space under itself.
export default function SectionHeader({ title, sub, actions, flush, foldOnPhone }: { title: string; sub?: ReactNode; actions?: ReactNode; flush?: boolean; foldOnPhone?: string }) {
  const tab = useSyncExternalStore(subscribeTopTab, topTab, () => null);
  const byTab = !!tab && tab.toLowerCase() !== title.toLowerCase();
  return (
    <div data-section-header className={`${styles.header} ${flush ? styles.flush : ''}`}>
      <div className={styles.text}>
        {byTab && <p className={styles.kicker}>{title}</p>}
        <h1 className={styles.title}>{byTab ? tab : title}</h1>
        {sub && <p className={styles.sub}>{sub}</p>}
        {sub && foldOnPhone && (
          <div className={styles.phoneFold}>
            <PhoneFold label={foldOnPhone}>{sub}</PhoneFold>
          </div>
        )}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}

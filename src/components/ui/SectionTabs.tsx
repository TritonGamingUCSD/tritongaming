'use client';

import type { ReactNode } from 'react';
import styles from './SectionTabs.module.css';

export interface SectionTab<T extends string = string> {
  id: T;
  label: string;
  icon?: ReactNode;
  badge?: number; // gold attention badge (hidden at 0)
  count?: number; // quiet total, always shown
}

// The one tab bar for every portal section: sits directly under the section's
// title, left-aligned, underline style. `segmented` is for small inner toggles
// (e.g. a sub-view switch) where a full-width underline would be too much.
// Pass only the tabs the viewer may see. Arrow keys / Home / End move between
// tabs, as in a normal ARIA tablist.
export default function SectionTabs<T extends string>({
  tabs, value, onChange, variant = 'underline', label = 'Sections',
}: {
  tabs: SectionTab<T>[];
  value: T;
  onChange: (id: T) => void;
  variant?: 'underline' | 'segmented';
  label?: string;
}) {
  function onKeyDown(e: React.KeyboardEvent, index: number) {
    let next = index;
    if (e.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    else return;
    e.preventDefault();
    onChange(tabs[next].id);
    (e.currentTarget.parentElement?.children[next] as HTMLElement | undefined)?.focus();
  }

  return (
    <div className={`${styles.bar} ${variant === 'segmented' ? styles.segmented : ''}`} role="tablist" aria-label={label}>
      {tabs.map((t, i) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            className={`${styles.tab} ${active ? styles.active : ''}`}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {t.icon && <span className={styles.icon} aria-hidden="true">{t.icon}</span>}
            <span>{t.label}</span>
            {t.badge !== undefined && t.badge > 0 && <span className={styles.badge}>{t.badge}</span>}
            {t.count !== undefined && <span className={styles.count}>{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

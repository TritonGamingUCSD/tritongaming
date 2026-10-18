'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import styles from './SectionTabs.module.css';

export interface SectionTab<T extends string = string> {
  id: T;
  label: string;
  icon?: ReactNode;
  badge?: number; // gold attention badge (hidden at 0)
  count?: number; // quiet total, always shown
}

// Labels are always shown in Title Case ("My Meetings", "Login & Security"), whatever the caller wrote, so tabs read the same everywhere.
// Short joining words stay lower case, and a word that already has a capital inside it (TG, QR, iPhone) is left alone.
const SMALL = new Set(['and', 'or', 'of', 'the', 'to', 'in', 'a', 'an', 'for', 'on', 'at', 'by']);
export function titleCase(label: string): string {
  return label.split(' ').map((w, i) => (w.length === 0 || /[A-Z]/.test(w.slice(1)) || /^[^a-zA-Z]/.test(w) ? w : i > 0 && SMALL.has(w.toLowerCase()) ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1))).join(' ');
}

// The one tab bar for every portal section: sits directly under the section's
// title, left-aligned, underline style. `segmented` is for small inner toggles
// (e.g. a sub-view switch) where a full-width underline would be too much.
// Two levels only: underline tabs (with icons) at the top of a section, the small pill switch for a view inside a tab (no icons, even if given).
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
  // The row only scrolls (and only fades at its edge) when the tabs really do not fit; the active tab is kept in view then.
  const bar = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false);
  useEffect(() => {
    const el = bar.current;
    if (!el) return;
    const check = () => { setOverflow(el.scrollWidth > el.clientWidth + 1); };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [tabs.length, variant]);
  useEffect(() => {
    if (!overflow) return;
    (bar.current?.querySelector('[aria-selected="true"]') as HTMLElement | null)?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [overflow, value]);

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
    <div ref={bar} data-overflow={overflow ? '1' : undefined} className={`${styles.bar} ${variant === 'segmented' ? styles.segmented : ''}`} role="tablist" aria-label={label}>
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
            {t.icon && variant !== 'segmented' && <span className={styles.icon} aria-hidden="true">{t.icon}</span>}
            <span>{titleCase(t.label)}</span>
            {t.badge !== undefined && t.badge > 0 && <span className={styles.badge}>{t.badge}</span>}
            {t.count !== undefined && <span className={styles.count}>{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

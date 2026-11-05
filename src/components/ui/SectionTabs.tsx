'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
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
  return label
    .split(' ')
    .map((w, i) =>
      w.length === 0 || /[A-Z]/.test(w.slice(1)) || /^[^a-zA-Z]/.test(w) ? w : i > 0 && SMALL.has(w.toLowerCase()) ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1),
    )
    .join(' ');
}

// The one tab bar for every portal section: sits directly under the section's
// title, left-aligned, underline style. `segmented` is for small inner toggles
// (e.g. a sub-view switch) where a full-width underline would be too much.
// Two levels only: underline tabs (with icons) at the top of a section, the small pill switch for a view inside a tab (no icons, even if given).
// Pass only the tabs the viewer may see. Arrow keys / Home / End move between
// tabs, as in a normal ARIA tablist.
export default function SectionTabs<T extends string>({
  tabs,
  value,
  onChange,
  variant = 'underline',
  label = 'Sections',
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
    const check = () => {
      setOverflow(el.scrollWidth > el.clientWidth + 1);
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [tabs.length, variant]);
  useEffect(() => {
    if (!overflow) return;
    (bar.current?.querySelector('[aria-selected="true"]') as HTMLElement | null)?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [overflow, value]);

  // The line under the open tab slides to the next one (set straight on the element, so no extra render).
  const line = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = bar.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    const ln = line.current;
    if (!el || !ln) return;
    ln.style.width = `${el.offsetWidth}px`;
    ln.style.transform = `translateX(${el.offsetLeft}px)`;
  }, [value, tabs, overflow, variant]);

  // Changing tab slides the page content a few pixels in the direction of travel (the elements after the bar, once the new tab has drawn).
  function slideTo(id: T, index: number) {
    const from = tabs.findIndex((x) => x.id === value);
    onChange(id);
    if (variant === 'segmented' || from < 0 || from === index || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const dir = index > from ? 1 : -1;
    const host = bar.current?.parentElement;
    window.setTimeout(() => {
      let el = bar.current?.nextElementSibling;
      while (el) {
        if (el !== host && 'animate' in el)
          (el as HTMLElement).animate(
            [
              { opacity: 0, transform: `translateX(${dir * 14}px)` },
              { opacity: 1, transform: 'none' },
            ],
            { duration: 220, easing: 'ease-out' },
          );
        el = el.nextElementSibling;
      }
    }, 40);
  }

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

  const picker = variant !== 'segmented' && tabs.length > 3;
  return (
    <>
      {picker && (
        <select className={styles.picker} aria-label={label} value={value} onChange={(e) => onChange(e.target.value as T)}>
          {tabs.map((t) => (
            <option key={t.id} value={t.id}>
              {titleCase(t.label)}
              {t.badge ? ` (${t.badge})` : ''}
            </option>
          ))}
        </select>
      )}
      <div
        ref={bar}
        data-overflow={overflow ? '1' : undefined}
        className={`${styles.bar} ${variant === 'segmented' ? styles.segmented : ''} ${picker ? styles.hasPicker : ''}`}
        role="tablist"
        aria-label={label}
      >
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
              onClick={() => slideTo(t.id, i)}
              onKeyDown={(e) => onKeyDown(e, i)}
            >
              {t.icon && variant !== 'segmented' && (
                <span className={styles.icon} aria-hidden="true">
                  {t.icon}
                </span>
              )}
              <span>{titleCase(t.label)}</span>
              {t.badge !== undefined && t.badge > 0 && <span className={styles.badge}>{t.badge}</span>}
              {t.count !== undefined && <span className={styles.count}>{t.count}</span>}
            </button>
          );
        })}
        {variant !== 'segmented' && <span ref={line} className={styles.line} aria-hidden="true" />}
      </div>
    </>
  );
}

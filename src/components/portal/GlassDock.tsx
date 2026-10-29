'use client';

import { useLayoutEffect, useRef, type ReactNode } from 'react';
import styles from './GlassDock.module.css';

export interface DockEntry {
  id: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
  active?: boolean;
  /** Something is happening right now (an event today, the meeting): a small live dot. */
  urgent?: boolean;
  badge?: number | string;
  /** The raised round button in the middle (Scan). */
  raised?: boolean;
  ariaLabel?: string;
  expanded?: boolean;
}

// The phone's bottom bar, in the "liquid glass" look: a floating capsule of frosted, see-through material (the page scrolls visibly beneath it), a bright edge and a soft highlight across the
// top, and a glass "lens" under the open destination that glides between slots with a springy ease. The lens is placed from the slot's measured position (a CSS transform, so moving it
// costs nothing); with reduced motion it just jumps.
export default function GlassDock({ items, label = 'Portal quick navigation' }: { items: DockEntry[]; label?: string }) {
  const nav = useRef<HTMLElement>(null);
  const activeId = items.find((i) => i.active && !i.raised)?.id ?? '';
  const slots = items.map((i) => i.id).join('|');

  useLayoutEffect(() => {
    const el = nav.current;
    if (!el) return;
    const place = () => {
      const on = activeId ? el.querySelector<HTMLElement>(`[data-dock="${CSS.escape(activeId)}"]`) : null;
      if (!on) {
        el.dataset.lens = 'off';
        return;
      }
      el.style.setProperty('--lens-x', `${on.offsetLeft}px`);
      el.style.setProperty('--lens-w', `${on.offsetWidth}px`);
      el.dataset.lens = 'on';
      // The very first placement must not glide in from the corner.
      requestAnimationFrame(() => {
        el.dataset.ready = '1';
      });
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(el);
    return () => ro.disconnect();
  }, [activeId, slots]);

  return (
    <nav ref={nav} className={styles.bar} aria-label={label} data-lens="off">
      <span className={styles.lens} aria-hidden="true" />
      {items.map((i) => (
        <button
          key={i.id}
          type="button"
          data-dock={i.id}
          className={`${styles.item} ${i.active ? styles.active : ''} ${i.urgent ? styles.urgent : ''} ${i.raised ? styles.raised : ''}`}
          onClick={i.onClick}
          aria-label={i.ariaLabel}
          aria-expanded={i.expanded}
          aria-current={i.active && !i.raised ? 'page' : undefined}
        >
          <span className={i.raised ? styles.orb : styles.icon}>
            {i.icon}
            {i.badge !== undefined && i.badge !== 0 && <span className={styles.badge}>{i.badge}</span>}
          </span>
          <span className={styles.label}>{i.label}</span>
        </button>
      ))}
    </nav>
  );
}

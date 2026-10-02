'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { createPortal } from 'react-dom';
import styles from './Popover.module.css';

// A floating panel anchored to a trigger: rendered in <body> (so no overflow:hidden parent can clip it),
// flips above the trigger near the bottom of the screen, closes on outside click / Escape, and follows
// the trigger on scroll. Used by the date and time pickers.
export default function Popover({ anchor, onClose, width = 280, children, label }: { anchor: RefObject<HTMLElement | null>; onClose: () => void; width?: number; children: ReactNode; label?: string }) {
  const panel = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number; maxHeight: number } | null>(null);

  const place = useCallback(() => {
    const r = anchor.current?.getBoundingClientRect();
    if (!r) return;
    const h = panel.current?.offsetHeight ?? 340;
    const below = window.innerHeight - r.bottom - 8;
    const above = r.top - 8;
    const up = below < h && above > below;
    const left = Math.min(Math.max(8, r.left), Math.max(8, window.innerWidth - width - 8));
    setPos(up ? { left, bottom: window.innerHeight - r.top + 4, maxHeight: above } : { left, top: r.bottom + 4, maxHeight: below });
  }, [anchor, width]);

  useLayoutEffect(() => { place(); }, [place, children]);
  useEffect(() => {
    const down = (e: MouseEvent) => { const t = e.target as Node; if (!panel.current?.contains(t) && !anchor.current?.contains(t)) onClose(); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    const move = (e: Event) => { if (!panel.current?.contains(e.target as Node)) place(); };
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    window.addEventListener('scroll', move, true);
    window.addEventListener('resize', place);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); window.removeEventListener('scroll', move, true); window.removeEventListener('resize', place); };
  }, [anchor, onClose, place]);

  return createPortal(
    <div ref={panel} role="dialog" aria-label={label} className={styles.panel} style={{ width, left: pos?.left ?? -9999, top: pos?.top, bottom: pos?.bottom, maxHeight: pos?.maxHeight, visibility: pos ? 'visible' : 'hidden' }}>
      {children}
    </div>,
    document.body,
  );
}

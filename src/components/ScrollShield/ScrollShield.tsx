'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './ScrollShield.module.css';

// Maps and social posts are iframes: they swallow the mouse wheel and touch moves that start over them, so the page stalls or jumps while
// someone scrolls past. A transparent cover keeps the page scrolling normally over them; tapping or clicking the cover switches the embed on,
// and it switches off again when the pointer leaves it or anything outside it is touched.
export default function ScrollShield({ children, label = 'Tap to use', className = '' }: { children: React.ReactNode; label?: string; className?: string }) {
  const [on, setOn] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!on) return;
    const outside = (e: Event) => { if (!ref.current?.contains(e.target as Node)) setOn(false); };
    const el = ref.current;
    const leave = () => setOn(false);
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('touchstart', outside, true);
    el?.addEventListener('mouseleave', leave);
    return () => { document.removeEventListener('pointerdown', outside, true); document.removeEventListener('touchstart', outside, true); el?.removeEventListener('mouseleave', leave); };
  }, [on]);

  return (
    <div ref={ref} className={`${styles.shield} ${className}`}>
      {children}
      {!on && (
        <button type="button" className={styles.cover} onClick={() => setOn(true)} aria-label={label}>
          <span className={styles.chip}>{label}</span>
        </button>
      )}
    </div>
  );
}

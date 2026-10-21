'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import styles from './logistics.module.css';

// The form shell for Logistics: the same job as a dialog (a title, the fields, Save and Cancel), but it opens inside the page where the thing it changes is, instead of floating over it, so
// everything is done in one interface. It scrolls itself into view when it opens; Escape closes it (unless it is busy saving). Content goes in as children, with <DialogActions> for the buttons.
export default function Panel({ title, busy = false, onClose, children }: { title: string; wide?: boolean; tone?: 'default' | 'danger'; busy?: boolean; onClose: () => void; children: ReactNode; label?: string }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => { ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, []);
  return (
    <section ref={ref} className={styles.inlinePanel} aria-label={title} onKeyDown={(e) => { if (e.key === 'Escape' && !busy) { e.stopPropagation(); onClose(); } }}>
      <div className={styles.inlineHead}>
        <h3 className={styles.panelTitle}>{title}</h3>
        <button type="button" className={styles.iconBtn} onClick={onClose} disabled={busy} aria-label="Close"><X size={16} aria-hidden="true" /></button>
      </div>
      {children}
    </section>
  );
}

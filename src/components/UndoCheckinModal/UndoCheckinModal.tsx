'use client';

import { createPortal } from 'react-dom';
import { TriangleAlert, X } from 'lucide-react';
import HoldButton from '@/components/HoldToConfirm/HoldButton';
import styles from './UndoCheckinModal.module.css';

// Undoing a check-in reverses the person's points, so it needs a deliberate
// press-and-hold (see HoldButton) rather than a tap-and-OK, especially
// mid-event on a phone.
export default function UndoCheckinModal({
  name, busy = false, onConfirm, onCancel,
}: {
  name?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return createPortal(
    <div className={styles.backdrop} onClick={(e) => { if (e.target === e.currentTarget && !busy) onCancel(); }}>
      <div className={styles.sheet} role="dialog" aria-modal="true" aria-label="Undo check-in">
        <button type="button" className={styles.closeBtn} onClick={onCancel} disabled={busy} aria-label="Cancel">
          <X size={18} strokeWidth={1.75} />
        </button>
        <div className={styles.icon}><TriangleAlert size={26} strokeWidth={1.75} aria-hidden="true" /></div>
        <h2 className={styles.title}>Undo {name ? `${name}’s` : 'this'} check-in?</h2>
        <p className={styles.text}>
          The ticket goes back to unused, and the points they earned for this check-in are taken back
          (along with any referral bonus it triggered). They’ll need to be scanned again to get in.
        </p>
        <HoldButton label="Hold to undo check-in" onConfirm={onConfirm} busy={busy} />
        <button type="button" className={styles.cancelBtn} onClick={onCancel} disabled={busy}>Cancel</button>
      </div>
    </div>,
    document.body
  );
}

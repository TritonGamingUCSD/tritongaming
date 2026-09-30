'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { TriangleAlert, X } from 'lucide-react';
import styles from './UndoCheckinModal.module.css';

const HOLD_MS = 1500;

// Undoing a check-in reverses the person's points, so a single tap-and-OK
// (the old window.confirm) was too easy to hit by accident — especially
// mid-event on a phone. This spells out what happens and only proceeds
// after a deliberate press-and-hold on the confirm button (or holding
// Space/Enter on it, for keyboard users).
export default function UndoCheckinModal({
  name, busy = false, onConfirm, onCancel,
}: {
  name?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [progress, setProgress] = useState(0);
  const raf = useRef<number | null>(null);
  const startedAt = useRef<number | null>(null);
  const fired = useRef(false);

  function stop() {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = null;
    startedAt.current = null;
    if (!fired.current) setProgress(0);
  }

  function tick() {
    if (startedAt.current === null) return;
    const p = Math.min(1, (performance.now() - startedAt.current) / HOLD_MS);
    setProgress(p);
    if (p >= 1) {
      fired.current = true;
      raf.current = null;
      startedAt.current = null;
      onConfirm();
      return;
    }
    raf.current = requestAnimationFrame(tick);
  }

  function start() {
    if (busy || fired.current || startedAt.current !== null) return;
    startedAt.current = performance.now();
    raf.current = requestAnimationFrame(tick);
  }

  useEffect(() => () => { if (raf.current) cancelAnimationFrame(raf.current); }, []);

  // A failed undo leaves the modal open — let them try the hold again.
  useEffect(() => {
    if (!busy) { fired.current = false; setProgress(0); }
  }, [busy]);

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
        <button
          type="button"
          className={styles.holdBtn}
          disabled={busy}
          onPointerDown={start}
          onPointerUp={stop}
          onPointerLeave={stop}
          onPointerCancel={stop}
          onContextMenu={(e) => e.preventDefault()}
          onKeyDown={(e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); start(); } }}
          onKeyUp={(e) => { if (e.key === ' ' || e.key === 'Enter') stop(); }}
          onBlur={stop}
        >
          <span className={styles.holdFill} style={{ transform: `scaleX(${progress})` }} />
          <span className={styles.holdLabel}>{busy ? 'Undoing…' : progress > 0 ? 'Keep holding…' : 'Hold to undo check-in'}</span>
        </button>
        <button type="button" className={styles.cancelBtn} onClick={onCancel} disabled={busy}>Cancel</button>
      </div>
    </div>,
    document.body
  );
}

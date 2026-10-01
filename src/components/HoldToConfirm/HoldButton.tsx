'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './HoldToConfirm.module.css';

// A button you have to press and HOLD to confirm — releasing early cancels. The
// standard way to confirm anything that can't be undone, instead of a typed
// confirmation or an easy-to-mis-tap OK button. Works with mouse, touch and
// keyboard (hold Space/Enter).
export default function HoldButton({
  label, holdingLabel = 'Keep holding…', busyLabel = 'Working…', onConfirm, disabled = false, busy = false, durationMs = 1500, className = '',
}: {
  label: string;
  holdingLabel?: string;
  busyLabel?: string;
  onConfirm: () => void;
  disabled?: boolean;
  busy?: boolean;
  durationMs?: number;
  className?: string;
}) {
  const [progress, setProgress] = useState(0);
  const raf = useRef<number | null>(null);
  const startedAt = useRef<number | null>(null);
  const fired = useRef(false);
  const onConfirmRef = useRef(onConfirm);
  useEffect(() => { onConfirmRef.current = onConfirm; }, [onConfirm]);

  function stop() {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = null;
    startedAt.current = null;
    if (!fired.current) setProgress(0);
  }

  function tick() {
    if (startedAt.current === null) return;
    const p = Math.min(1, (performance.now() - startedAt.current) / durationMs);
    setProgress(p);
    if (p >= 1) {
      fired.current = true;
      raf.current = null;
      startedAt.current = null;
      onConfirmRef.current();
      return;
    }
    raf.current = requestAnimationFrame(tick);
  }

  function start() {
    if (disabled || busy || fired.current || startedAt.current !== null) return;
    startedAt.current = performance.now();
    raf.current = requestAnimationFrame(tick);
  }

  useEffect(() => () => { if (raf.current) cancelAnimationFrame(raf.current); }, []);

  // A failed action leaves the dialog open — let them hold again.
  useEffect(() => {
    if (!busy) { fired.current = false; setProgress(0); }
  }, [busy]);

  return (
    <button
      type="button"
      className={`${styles.hold} ${className}`}
      disabled={disabled || busy}
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
      <span className={styles.holdLabel}>{busy ? busyLabel : progress > 0 ? holdingLabel : label}</span>
    </button>
  );
}

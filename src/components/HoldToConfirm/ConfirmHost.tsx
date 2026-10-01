'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { TriangleAlert, X } from 'lucide-react';
import HoldButton from './HoldButton';
import { CONFIRM_HOLD_EVENT, type ConfirmHoldRequest } from '@/lib/confirmHold';
import styles from './HoldToConfirm.module.css';

// Mounted once in the root layout; renders the dialog for confirmHold().
export default function ConfirmHost() {
  const [request, setRequest] = useState<ConfirmHoldRequest | null>(null);

  useEffect(() => {
    const onRequest = (e: Event) => {
      const next = (e as CustomEvent<ConfirmHoldRequest>).detail;
      // One at a time: a request that arrives while another is open is declined.
      setRequest((current) => { if (current) { next.resolve(false); return current; } return next; });
    };
    window.addEventListener(CONFIRM_HOLD_EVENT, onRequest);
    return () => window.removeEventListener(CONFIRM_HOLD_EVENT, onRequest);
  }, []);

  if (!request) return null;

  function finish(confirmed: boolean) {
    request?.resolve(confirmed);
    setRequest(null);
  }

  return createPortal(
    <div className={styles.backdrop} onClick={(e) => { if (e.target === e.currentTarget) finish(false); }}>
      <div className={styles.sheet} role="alertdialog" aria-modal="true" aria-label={request.title}>
        <div className={styles.icon}><TriangleAlert size={26} strokeWidth={1.75} aria-hidden="true" /></div>
        <h2 className={styles.title}>{request.title}</h2>
        {request.message && <p className={styles.text}>{request.message}</p>}
        <p className={styles.text}>This can&apos;t be undone. Press and hold the button to confirm.</p>
        <HoldButton label={request.confirmLabel ?? 'Hold to confirm'} onConfirm={() => finish(true)} />
        <button type="button" className={styles.cancel} onClick={() => finish(false)}>Cancel</button>
      </div>
    </div>,
    document.body
  );
}

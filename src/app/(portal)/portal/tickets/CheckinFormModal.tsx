'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ExternalLink } from 'lucide-react';
import styles from './checkinformmodal.module.css';

// Shared "here's your AS Form" surface — used both right after a fresh
// check-in (OnlineCheckinEntry) and as a standing fallback on an
// already-checked-in ticket (TicketRow's "Complete AS Form" button), so
// someone who dismissed it, lost connection, or got checked in manually by
// staff without their phone in hand isn't just stuck without it. Portaled
// to <body> for the same reason FullscreenQR is — a Framer-Motion
// `transform` ancestor would otherwise trap a `position: fixed` backdrop
// inside its own stacking context, below the bottom nav bar.
export default function CheckinFormModal({
  ticketId, url, onClose, onComplete,
}: {
  ticketId: string;
  url: string;
  onClose: () => void;
  // Fired once the ticket holder explicitly confirms they finished it —
  // NOT fired by the plain X/backdrop dismiss below, so closing without
  // confirming leaves "Complete AS Form" reopenable later rather than
  // silently marking something that may never have actually happened.
  onComplete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');

  function onBackdrop(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  // This only records that they *told us* they finished — the app has no
  // way to see inside the iframe and confirm an actual Google Forms
  // submission (cross-origin, no callback). It exists so our own UI stops
  // re-offering the form once someone's done with it, not as proof of
  // anything. The real backstop against an actual duplicate submission is
  // the form's own "Limit to 1 response" setting, which is on Google's
  // side, not ours.
  async function handleComplete() {
    setConfirming(true);
    setError('');
    try {
      const res = await fetch(`/api/tickets/${ticketId}/checkin-form-complete`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save — please try again.');
      }
      onComplete();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save — please try again.');
    } finally {
      setConfirming(false);
    }
  }

  return createPortal(
    <div className={styles.backdrop} onClick={onBackdrop}>
      <div className={styles.sheet}>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close without confirming">
          <X size={18} strokeWidth={1.75} />
        </button>
        <div className={styles.header}>
          <h2 className={styles.title}>UCSD Check-In Form</h2>
          <p className={styles.hint}>Required by UCSD — most of it's already filled in for you.</p>
        </div>
        <iframe src={url} className={styles.frame} title="UCSD check-in form">
          Loading…
        </iframe>
        <a href={url} target="_blank" rel="noopener noreferrer" className={styles.newTabLink}>
          <ExternalLink size={13} strokeWidth={1.75} aria-hidden="true" /> Form not loading? Open it in a new tab
        </a>
        {error && <p className={styles.error}>{error}</p>}
        <button type="button" className={styles.doneBtn} onClick={handleComplete} disabled={confirming}>
          {confirming ? 'Saving…' : "I've Completed This Form"}
        </button>
        <p className={styles.smallPrint}>Only tap this after you've actually hit Submit on the form above.</p>
      </div>
    </div>,
    document.body
  );
}

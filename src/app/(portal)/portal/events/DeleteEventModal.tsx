'use client';

import { showToast } from '@/lib/toast';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { AlertTriangle, X } from 'lucide-react';
import styles from './deleteeventmodal.module.css';

// Three deliberate steps before anything is deleted: read what will be
// wiped, re-confirm with the actual numbers, then type the event's exact
// title. The server re-checks the title and the admin-only capability, so
// this UI is a speed bump against accidents, not the security boundary.
export default function DeleteEventModal({
  event, onClose,
}: {
  event: { id: string; title: string; ticketsIssued: number; ticketsCheckedIn: number };
  onClose: () => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [reversePoints, setReversePoints] = useState(true);
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const titleMatches = typed.trim() === event.title.trim();

  async function handleDelete() {
    if (!titleMatches || deleting) return;
    setDeleting(true);
    setError('');
    try {
      const res = await fetch(`/api/events/${event.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmTitle: typed, reversePoints }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Failed to delete event.');
      showToast('Event deleted');
      router.refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete event.');
      setDeleting(false);
    }
  }

  return createPortal(
    <div className={styles.backdrop} onClick={(e) => { if (e.target === e.currentTarget && !deleting) onClose(); }}>
      <div className={styles.sheet} role="dialog" aria-modal="true" aria-label="Delete event">
        <button type="button" className={styles.closeBtn} onClick={onClose} disabled={deleting} aria-label="Cancel">
          <X size={18} strokeWidth={1.75} />
        </button>
        <div className={styles.icon}><AlertTriangle size={26} strokeWidth={1.75} aria-hidden="true" /></div>
        <p className={styles.stepLabel}>Step {step} of 3</p>

        {step === 1 && (
          <>
            <h2 className={styles.title}>Delete “{event.title}”?</h2>
            <p className={styles.text}>This permanently removes:</p>
            <ul className={styles.list}>
              <li>The event and its public page</li>
              <li><strong>{event.ticketsIssued}</strong> ticket{event.ticketsIssued === 1 ? '' : 's'} ({event.ticketsCheckedIn} checked in) — attendees lose them and their attendance record</li>
              <li>The uploaded flyer image</li>
            </ul>
            <p className={styles.text}>Photo albums linked to it are kept, just unlinked.</p>
            <label className={styles.check}>
              <input type="checkbox" checked={reversePoints} onChange={(e) => setReversePoints(e.target.checked)} />
              <span>Also take back the points attendees earned from checking in to this event</span>
            </label>
            <div className={styles.actions}>
              <button type="button" className={styles.cancelBtn} onClick={onClose}>Cancel</button>
              <button type="button" className={styles.dangerBtn} onClick={() => setStep(2)}>Continue</button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className={styles.title}>This can’t be undone</h2>
            <p className={styles.text}>
              There is no trash or restore. {event.ticketsIssued} ticket{event.ticketsIssued === 1 ? '' : 's'} will be
              deleted{reversePoints ? ', and check-in points for this event will be taken back from attendees' : ', and attendees will keep the points they already earned'}.
              If you only want it hidden, unpublish it instead.
            </p>
            <div className={styles.actions}>
              <button type="button" className={styles.cancelBtn} onClick={() => setStep(1)}>Back</button>
              <button type="button" className={styles.dangerBtn} onClick={() => setStep(3)}>I understand, continue</button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h2 className={styles.title}>Type the event name to confirm</h2>
            <p className={styles.text}>Type <strong>{event.title}</strong> exactly:</p>
            <input
              className={styles.input}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={event.title}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              autoFocus
            />
            {error && <p className={styles.error}>{error}</p>}
            <div className={styles.actions}>
              <button type="button" className={styles.cancelBtn} onClick={() => setStep(2)} disabled={deleting}>Back</button>
              <button type="button" className={styles.dangerBtn} onClick={handleDelete} disabled={!titleMatches || deleting}>
                {deleting ? 'Deleting…' : 'Permanently delete'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

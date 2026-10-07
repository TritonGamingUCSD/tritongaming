'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Dialog, { DialogText, DialogKicker, DialogList, DialogActions, DialogCancel, DialogDanger, DialogOption } from '@/components/ui/Dialog';
import Notice from '@/components/ui/Notice';
import HoldButton from '@/components/HoldToConfirm/HoldButton';
import { showToast } from '@/lib/ui/toast';

// Three deliberate steps before anything is deleted: read what will be
// wiped, re-confirm with the actual numbers, then press and hold the button.
// The server re-checks the title and the admin-only capability, so this UI is
// a speed bump against accidents, not the security boundary.
export default function DeleteEventModal({
  event, onClose,
}: {
  event: { id: string; title: string; ticketsIssued: number; ticketsCheckedIn: number };
  onClose: () => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [reversePoints, setReversePoints] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const plural = event.ticketsIssued === 1 ? '' : 's';

  async function handleDelete() {
    if (deleting) return;
    setDeleting(true);
    setError('');
    try {
      const res = await fetch(`/api/events/${event.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmTitle: event.title, reversePoints }),
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

  const titles = { 1: `Delete “${event.title}”?`, 2: 'This can’t be undone', 3: 'Press and hold to delete' } as const;

  return (
    <Dialog title={titles[step]} tone="danger" busy={deleting} onClose={onClose} label="Delete event">
      <DialogKicker>Step {step} of 3</DialogKicker>

      {step === 1 && (
        <>
          <DialogText>This permanently removes:</DialogText>
          <DialogList>
            <li>The event and its public page</li>
            <li><strong>{event.ticketsIssued}</strong> ticket{plural} ({event.ticketsCheckedIn} checked in) — attendees lose them and their attendance record</li>
            <li>The uploaded flyer image</li>
          </DialogList>
          <DialogText>Photo albums linked to it are kept, just unlinked.</DialogText>
          <DialogOption checked={reversePoints} onChange={setReversePoints}>
            Also take back the points attendees earned from checking in to this event
          </DialogOption>
          <DialogActions>
            <DialogCancel onClick={onClose} />
            <DialogDanger onClick={() => setStep(2)}>Continue</DialogDanger>
          </DialogActions>
        </>
      )}

      {step === 2 && (
        <>
          <DialogText>
            There is no trash or restore. {event.ticketsIssued} ticket{plural} will be
            deleted{reversePoints ? ', and check-in points for this event will be taken back from attendees' : ', and attendees will keep the points they already earned'}.
            If you only want it hidden, unpublish it instead.
          </DialogText>
          <DialogActions>
            <DialogCancel onClick={() => setStep(1)}>Back</DialogCancel>
            <DialogDanger onClick={() => setStep(3)}>I understand, continue</DialogDanger>
          </DialogActions>
        </>
      )}

      {step === 3 && (
        <>
          <DialogText>
            Hold the button below to permanently delete <strong>{event.title}</strong>. Letting go early cancels.
          </DialogText>
          {error && <Notice tone="error" onLight>{error}</Notice>}
          <HoldButton label="Hold to permanently delete" onConfirm={handleDelete} busy={deleting} durationMs={2000} />
          <DialogActions>
            <DialogCancel onClick={() => setStep(2)} disabled={deleting}>Back</DialogCancel>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
}

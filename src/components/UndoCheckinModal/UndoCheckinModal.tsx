'use client';

import Dialog, { DialogText, DialogCancel } from '@/components/ui/Dialog';
import HoldButton from '@/components/HoldToConfirm/HoldButton';

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
  return (
    <Dialog title={`Undo ${name ? `${name}’s` : 'this'} check-in?`} tone="danger" busy={busy} onClose={onCancel} label="Undo check-in">
      <DialogText>
        The ticket goes back to unused, and the points they earned for this check-in are taken back
        (along with any referral bonus it triggered). They’ll need to be scanned again to get in.
      </DialogText>
      <HoldButton label="Hold to undo check-in" onConfirm={onConfirm} busy={busy} />
      <DialogCancel onClick={onCancel} disabled={busy} />
    </Dialog>
  );
}

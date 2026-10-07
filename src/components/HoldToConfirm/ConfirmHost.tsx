'use client';

import { useEffect, useState } from 'react';
import Dialog, { DialogText, DialogCancel } from '@/components/ui/Dialog';
import HoldButton from './HoldButton';
import { CONFIRM_HOLD_EVENT, type ConfirmHoldRequest } from '@/lib/ui/confirmHold';

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

  return (
    <Dialog title={request.title} tone="danger" onClose={() => finish(false)}>
      {request.message && <DialogText>{request.message}</DialogText>}
      <DialogText>This can&apos;t be undone. Press and hold the button to confirm.</DialogText>
      <HoldButton label={request.confirmLabel ?? 'Hold to confirm'} onConfirm={() => finish(true)} />
      <DialogCancel onClick={() => finish(false)} />
    </Dialog>
  );
}

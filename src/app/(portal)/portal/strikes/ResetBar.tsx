'use client';

import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import { confirmHold } from '@/lib/ui/confirmHold';
import { ReasonForm } from './ReasonForm';

// Reset everyone's strikes (usually once a quarter). The old record is deleted for good; unused vouchers are kept.
export function ResetBar({ onDone }: { onDone: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  async function go(reason: string) {
    if (
      !(await confirmHold({
        title: 'Reset everyone’s strikes?',
        message:
          'This permanently deletes everyone’s strikes, warnings and history for everyone you can change. Nobody can open it afterwards, not even an admin. Each person only sees your reason. Unused vouchers are kept.',
        confirmLabel: 'Hold to reset',
      }))
    )
      return;
    setBusy(true);
    setError('');
    setNote('');
    const r = await fetch('/api/strikes/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) {
      setError(j.error || 'That didn’t work.');
      return;
    }
    setOpen(false);
    setNote(`Reset: ${j.strikes} strike${j.strikes === 1 ? '' : 's'} deleted for good. Your own record isn’t touched: someone else has to clear it.`);
    await onDone();
  }
  return (
    <div>
      {error && <Notice tone="error">{error}</Notice>}
      {note && <Notice tone="success">{note}</Notice>}
      {open ? (
        <ReasonForm
          label="Why you’re resetting (everyone will see this)"
          placeholder="e.g. Fall quarter reset"
          submit="Reset everyone’s strikes"
          busy={busy}
          onCancel={() => setOpen(false)}
          onSave={go}
        />
      ) : (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setOpen(true);
            setNote('');
          }}
        >
          <RotateCcw size={14} aria-hidden="true" /> Reset everyone’s strikes
        </Button>
      )}
    </div>
  );
}

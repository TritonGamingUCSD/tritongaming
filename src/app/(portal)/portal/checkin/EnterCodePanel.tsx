'use client';

import { useState } from 'react';
import CodeEntry from '@/components/portal/CodeEntry';
import CheckInOutcome from '@/components/portal/CheckInOutcome';
import { checkInWithCode, resolveChoice, confirmEventCheckIn, type Outcome } from '@/lib/checkin/anyCode';
import styles from './checkinsection.module.css';

// For staff on a computer (no camera to scan with): one box for any six-digit code, a meeting's or a ticket's, and it says which one it was.
// On a phone the Scan button in the bottom bar does the same, with the camera.
export default function EnterCodePanel() {
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  async function submit(code: string) {
    setBusy(true);
    setOutcome(await checkInWithCode(code));
    setBusy(false);
  }
  return (
    <section className={styles.codePanel} aria-label="Enter a code">
      <h2>Enter A Code</h2>
      {outcome ? (
        <CheckInOutcome
          outcome={outcome}
          doneLabel="Next"
          busy={busy}
          onDone={() => setOutcome(null)}
          onChoose={async (which) => {
            if (outcome.kind !== 'choose') return;
            setBusy(true);
            setOutcome(await resolveChoice(outcome.code, which));
            setBusy(false);
          }}
          onConfirmEvent={async () => {
            if (outcome.kind !== 'confirmEvent') return;
            setBusy(true);
            setOutcome(await confirmEventCheckIn(outcome.redo));
            setBusy(false);
          }}
        />
      ) : (
        <>
          <p>The 6-digit code from a ticket or from a meeting screen. It checks in whichever one it belongs to.</p>
          <CodeEntry onSubmit={(c) => void submit(c)} busy={busy} autoFocus />
        </>
      )}
    </section>
  );
}

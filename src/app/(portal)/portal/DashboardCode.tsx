'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Hash } from 'lucide-react';
import CheckInOutcome from '@/components/portal/CheckInOutcome';
import CodeEntry from '@/components/portal/CodeEntry';
import Dialog from '@/components/ui/Dialog';
import { checkInWithCode, confirmEventCheckIn, resolveChoice, type Outcome } from '@/lib/checkin/anyCode';
import styles from './dashboardHome.module.css';

// The one place to type a 6-digit code: a meeting's check-in code, a ticket's, or the code of a Trivia game or a poll. It sends itself on the sixth digit, then says what it was (a meeting or ticket is checked in; a game or a poll opens).
// No other page has a code box. On a phone the Scan button in the bottom bar reads the camera codes.
export default function DashboardCode() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const settle = (o: Outcome) => {
    if (o.kind === 'trivia') return router.push(`/portal/trivia/play/${o.code}`);
    if (o.kind === 'poll') return router.push(`/play/${o.code}`);
    if (o.kind === 'meeting') window.dispatchEvent(new Event('tg:meetings-changed'));
    setOutcome(o);
  };
  const submit = async (code: string) => {
    setBusy(true);
    const o = await checkInWithCode(code);
    setBusy(false);
    settle(o);
  };

  return (
    <section className={styles.code} aria-label="Enter a code">
      <span className={styles.codeIcon} aria-hidden="true">
        <Hash size={18} />
      </span>
      <div className={styles.codeText}>
        <h2>Enter A Code</h2>
        <p>A meeting check-in, a ticket, a Trivia game or a poll. Type the 6 digits shown on the screen.</p>
      </div>
      <div className={styles.codeBox}>
        <CodeEntry onSubmit={(c) => void submit(c)} busy={busy} />
      </div>
      {outcome && (
        <Dialog title={outcome.kind === 'error' ? 'That Code Didn’t Work' : 'Code Entered'} onClose={() => setOutcome(null)}>
          <CheckInOutcome
            outcome={outcome}
            busy={busy}
            doneLabel="Done"
            onDone={() => setOutcome(null)}
            onChoose={async (which) => {
              if (outcome.kind !== 'choose') return;
              setBusy(true);
              const o = await resolveChoice(outcome.code, which);
              setBusy(false);
              settle(o);
            }}
            onConfirmEvent={async () => {
              if (outcome.kind !== 'confirmEvent') return;
              setBusy(true);
              const o = await confirmEventCheckIn(outcome.redo);
              setBusy(false);
              settle(o);
            }}
          />
        </Dialog>
      )}
    </section>
  );
}

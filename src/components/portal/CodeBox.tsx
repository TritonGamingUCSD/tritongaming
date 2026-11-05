'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Hash } from 'lucide-react';
import CheckInOutcome from '@/components/portal/CheckInOutcome';
import CodeEntry from '@/components/portal/CodeEntry';
import Dialog from '@/components/ui/Dialog';
import { checkInWithCode, confirmEventCheckIn, type Outcome } from '@/lib/checkin/anyCode';
import { playFeedback } from '@/lib/ui/codeFeedback';

/** What happens after a 6-digit code is typed: a meeting is checked in, a ticket is checked in (staff), a Trivia game or a poll opens, and what happened is said in a pop-up on the page the person is already on (so a meeting's code typed on
 *  the meeting page stays on the meeting page, and the page refreshes). `dialog` is that pop-up: render it somewhere that stays on screen. */
export function useCodeFlow(): { submit: (code: string) => Promise<void>; busy: boolean; dialog: ReactNode; status: 'ok' | 'bad' | null } {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [status, setStatus] = useState<'ok' | 'bad' | null>(null);
  const reset = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(reset.current), []);

  const settle = (o: Outcome) => {
    const kind = o.kind === 'error' ? 'bad' : 'ok';
    setStatus(kind);
    playFeedback(kind);
    window.clearTimeout(reset.current);
    reset.current = window.setTimeout(() => setStatus(null), 900);
    if (o.kind === 'trivia') return router.push(`/portal/trivia/play/${o.code}`);
    if (o.kind === 'poll') return router.push(`/vote/${o.code}`);
    if (o.kind === 'meeting') window.dispatchEvent(new Event('tg:meetings-changed'));
    setOutcome(o);
  };
  const run = async (work: () => Promise<Outcome>) => {
    setBusy(true);
    const o = await work();
    setBusy(false);
    settle(o);
  };
  const dialog = outcome ? (
    <Dialog title={outcome.kind === 'error' ? 'That Code Didn’t Work' : 'Code Entered'} onClose={() => setOutcome(null)}>
      <CheckInOutcome
        outcome={outcome}
        busy={busy}
        doneLabel="Done"
        onDone={() => setOutcome(null)}
        onConfirmEvent={async () => {
          if (outcome.kind === 'confirmEvent') await run(() => confirmEventCheckIn(outcome.redo));
        }}
      />
    </Dialog>
  ) : null;
  return { submit: (code) => run(() => checkInWithCode(code)), busy, dialog, status };
}

// The portal's 6-digit code box with everything that follows it (see useCodeFlow). The box is in the sidebar of every portal page on a computer (`compact`), on the Dashboard, and at the bottom of the Scan page; while the sidebar is hidden the top bar's
// Code button opens the same box.
export default function CodeBox({ compact = false }: { compact?: boolean }) {
  const { submit, busy, dialog, status } = useCodeFlow();
  return (
    <>
      <CodeEntry onSubmit={(c) => void submit(c)} busy={busy} compact={compact} icon={compact ? <Hash /> : undefined} status={status} />
      {busy && (
        <p
          role="status"
          style={
            compact
              ? { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)' }
              : { margin: '0.4rem 0 0', fontSize: '0.85rem', textAlign: 'center', opacity: 0.8 }
          }
        >
          Checking the code…
        </p>
      )}
      {dialog}
    </>
  );
}

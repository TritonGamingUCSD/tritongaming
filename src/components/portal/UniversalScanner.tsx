'use client';

import { useEffect, useRef, useState } from 'react';
import { CircleAlert, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Dialog from '@/components/ui/Dialog';
import QrScanner from '@/app/(portal)/portal/meetings/QrScanner';
import CheckInOutcome from './CheckInOutcome';
import CodeEntry from './CodeEntry';
import { checkInWithCode, checkInWithQr, confirmReward, resolveChoice, RING, type Outcome } from '@/lib/checkin/anyCode';
import styles from './UniversalScanner.module.css';

const buzz = (pattern: number | number[]) => { try { navigator.vibrate?.(pattern); } catch { /* not supported */ } };

// What a scan turned into, said plainly: the person always sees exactly what it did (or did not do).
type State =
  | { kind: 'scanning' }
  | { kind: 'working'; label: string }
  | { kind: 'opening'; title: string; heading: string; text: string; href: string }
  | { kind: 'result'; outcome: Outcome };

// The one camera for the portal (the page behind the middle button of the phone's bottom bar), with the code box always at the bottom. It does what each QR the portal makes is for:
//   • a meeting's check-in QR → checks you in to that meeting, then tells you which one
//   • an event's self check-in QR (…/in/<event>) → opens that event's check-in page, which checks you in and shows the result
//   • (staff) an event ticket → checks it in and shows whose it is; a reward pickup → shows the reward with a Confirm button
//   • any other page of this portal → opens it
// The six-digit box takes a meeting code or (for staff) a ticket's code, whichever it turns out to be.
// Anything else is refused with a message, and the camera keeps looking.
export default function UniversalScanner({ onClose, staff = false, redemptions = false }: { onClose: () => void; staff?: boolean; redemptions?: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: 'scanning' });
  const [problem, setProblem] = useState('');
  const [attempt, setAttempt] = useState(0);   // a new number restarts the camera
  const [busy, setBusy] = useState(false);
  const goTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(goTimer.current), []);   // closing in the moment before a page opens cancels the move
  useEffect(() => { if (!problem) return; const id = window.setTimeout(() => setProblem(''), 5000); return () => window.clearTimeout(id); }, [problem]);

  const can = { tickets: staff, rewards: redemptions };

  const linkTarget = (text: string): { href: string; title: string; heading: string; text: string } | null => {
    try {
      const u = new URL(text.trim());
      const siteHost = /(^|\.)tritongaming\.org$/i.test(u.hostname);
      if (u.origin !== window.location.origin && !siteHost) return null;
      const ev = u.pathname.match(/^\/(?:portal\/)?in\/([^/]+)\/?$/);
      if (ev) return { href: `/portal/in/${ev[1]}`, title: 'Checking You In To The Event', heading: 'Event check-in', text: 'Opening the event’s check-in, which checks you in and shows the result.' };
      if (u.origin === window.location.origin && (u.pathname === '/portal' || u.pathname.startsWith('/portal/'))) return { href: `${u.pathname}${u.search}`, title: 'Opening The Page', heading: 'Portal page', text: 'Taking you there now.' };
    } catch { /* not a link */ }
    return null;
  };

  function go(href: string) {
    router.push(href);
  }

  async function finish(p: Promise<Outcome | null>) {
    const outcome = await p;
    if (!outcome) return;
    setState({ kind: 'result', outcome });
    buzz(outcome.kind === 'error' ? [60, 40, 60] : outcome.kind === 'ticket' && outcome.status !== 'active' ? [40, 40, 40] : 45);   // felt as well as seen
    if (outcome.kind === 'meeting') window.dispatchEvent(new Event('tg:meetings-changed'));
  }

  function onScan(text: string): boolean {
    const t = text.trim();
    const ring = t.match(RING);
    if (ring) {
      setProblem('');
      setState({ kind: 'working', label: ring?.[1] === 'm' ? 'Checking you in…' : ring?.[1] === 'r' ? 'Looking up the reward…' : 'Checking the ticket…' });
      void finish(checkInWithQr(t, can));
      return true;
    }
    const target = linkTarget(t);
    if (target) { setProblem(''); setState({ kind: 'opening', ...target }); goTimer.current = window.setTimeout(() => go(target.href), 900); return true; }
    setProblem('That isn’t a tgcode or a portal QR. Try another.');
    return false;
  }

  async function onCode(code: string) {
    setBusy(true);
    setState({ kind: 'working', label: 'Checking the code…' });
    await finish(checkInWithCode(code));
    setBusy(false);
  }

  const rescan = () => { setState({ kind: 'scanning' }); setAttempt((n) => n + 1); };

  if (state.kind === 'working') {
    return (
      <Dialog title="One Moment" onClose={onClose}>
        <div className={styles.result}><Loader2 size={34} className={styles.spin} aria-hidden="true" /><strong>{state.label}</strong></div>
      </Dialog>
    );
  }
  if (state.kind === 'opening') {
    // No extra tap: the page it points at opens by itself, after a moment to read what is happening.
    return (
      <Dialog title={state.title} onClose={onClose}>
        <div className={styles.result}>
          <Loader2 size={34} className={styles.spin} aria-hidden="true" />
          <strong>{state.heading}</strong>
          <span>{state.text}</span>
        </div>
      </Dialog>
    );
  }
  if (state.kind === 'result') {
    const o = state.outcome;
    const again = o.kind === 'ticket' || o.kind === 'rewardDone' || o.kind === 'error' || o.kind === 'reward' || o.kind === 'choose';
    return (
      <Dialog title={o.kind === 'error' ? 'Check-In' : o.kind === 'meeting' ? 'Meeting Check-In' : o.kind === 'ticket' ? 'Ticket Check-In' : 'Reward Pickup'} onClose={onClose}>
        <CheckInOutcome
          outcome={o}
          busy={busy}
          doneLabel={again ? 'Scan Next' : 'Done'}
          onDone={() => (again ? rescan() : onClose())}
          onChoose={async (which) => { if (o.kind !== 'choose') return; setBusy(true); await finish(resolveChoice(o.code, which)); setBusy(false); }}
          onConfirmReward={async () => {
            if (o.kind !== 'reward') return;
            setBusy(true);
            const done = await confirmReward(o.id, o.title, o.member);
            setState({ kind: 'result', outcome: done });
            buzz(done.kind === 'error' ? [60, 40, 60] : 45);
            setBusy(false);
          }}
        />
      </Dialog>
    );
  }
  return (
    <>
      <QrScanner
        key={attempt}
        onScan={onScan}
        onClose={onClose}
        title="Scan A tgcode"
        note="Point the camera at a tgcode (meeting, ticket or reward) or an event’s check-in QR."
        footer={<div className={styles.codeBar}><span>{staff ? 'Or type the 6-digit code (meeting or ticket)' : 'Or type the 6-digit code from the screen'}</span><CodeEntry dark onSubmit={(c) => void onCode(c)} busy={busy} /></div>}
      />
      {problem && (
        <div className={styles.toast} role="status"><CircleAlert size={16} aria-hidden="true" /> {problem}</div>
      )}
    </>
  );
}

'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, CircleAlert, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import QrScanner, { type ScanLock } from '@/app/(portal)/portal/meetings/QrScanner';
import CheckInOutcome from './CheckInOutcome';
import CodeEntry from './CodeEntry';
import { checkInWithCode, checkInWithQr, confirmReward, resolveChoice, TGCODE, type Outcome } from '@/lib/checkin/anyCode';
import styles from './UniversalScanner.module.css';

const MY_MEETING = '/portal/meetings?tab=mine';   // where a checked-in meeting's question and doc are

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
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);   // working for a while: say so, so a slow connection never looks like a frozen screen
  const goTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(goTimer.current), []);   // closing in the moment before a page opens cancels the move
  useEffect(() => { if (!problem) return; const id = window.setTimeout(() => setProblem(''), 5000); return () => window.clearTimeout(id); }, [problem]);

  useEffect(() => {
    setSlow(false);
    if (state.kind !== 'working' && state.kind !== 'opening' && !(state.kind === 'result' && state.outcome.kind === 'meeting')) return;
    const id = window.setTimeout(() => setSlow(true), 5000);
    return () => window.clearTimeout(id);
  }, [state]);

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
    if (outcome.kind === 'meeting') {
      window.dispatchEvent(new Event('tg:meetings-changed'));
      // The meeting's question and doc are on My Meetings, under "You're checked in": no prompt, the ring goes green and the page opens by itself.
      window.clearTimeout(goTimer.current);
      goTimer.current = window.setTimeout(() => go(MY_MEETING), 1000);   // long enough to see the green ring and check
    }
  }

  function onScan(text: string): boolean {
    const t = text.trim();
    const ring = t.match(TGCODE);
    if (ring) {
      setProblem('');
      setState({ kind: 'working', label: ring?.[1] === 'm' ? 'Checking you in…' : ring?.[1] === 'r' ? 'Looking up the reward…' : 'Checking the ticket…' });
      void finish(checkInWithQr(t, can));
      return true;
    }
    const target = linkTarget(t);
    if (target) { setProblem(''); setState({ kind: 'opening', ...target }); goTimer.current = window.setTimeout(() => go(target.href), 1000); return true; }
    setProblem('That isn’t a TGcode or a portal QR. Try another.');
    return false;
  }

  async function onCode(code: string) {
    setBusy(true);
    setState({ kind: 'working', label: 'Checking the code…' });
    await finish(checkInWithCode(code));
    setBusy(false);
  }

  const rescan = () => setState({ kind: 'scanning' });

  // The camera stays on screen the whole time: what a scan did shows on its ring, and the result slides up over the frozen picture.
  let lock: ScanLock | null = null;
  let sheet: ReactNode = null;
  if (state.kind === 'working') {
    lock = { tone: 'busy' };
    sheet = <div className={styles.result}><Loader2 size={30} className={styles.spin} aria-hidden="true" /><strong>{state.label}</strong>{slow && <span className={styles.slow}>The connection is slow. Still trying…</span>}</div>;
  } else if (state.kind === 'opening') {
    // No extra tap: the page it points at opens by itself, after a moment to read what is happening.
    lock = { tone: 'busy' };
    sheet = <div className={styles.result}><Loader2 size={30} className={styles.spin} aria-hidden="true" /><strong>{state.heading}</strong><span>{state.text}</span>{slow && <span className={styles.slow}>The connection is slow. Still trying…</span>}</div>;
  } else if (state.kind === 'result') {
    const o = state.outcome;
    const again = o.kind === 'ticket' || o.kind === 'rewardDone' || o.kind === 'error' || o.kind === 'reward' || o.kind === 'choose';
    lock = { tone: o.kind === 'error' ? 'bad' : o.kind === 'choose' || (o.kind === 'ticket' && o.status !== 'active') || (o.kind === 'meeting' && o.already) ? 'warn' : 'ok' };
    sheet = o.kind === 'meeting' ? (
      // The page it moves to opens by itself; until it has, this says so (a slow connection can take a while), with no button to press.
      <div className={styles.result}>
        <strong>{o.already ? 'You’re already checked in' : 'You’re checked in'}</strong>
        {o.title && <span>{o.title}</span>}
        <span className={styles.moving}><Loader2 size={15} className={styles.spin} aria-hidden="true" /> Opening My Meetings…{slow && ' (slow connection)'}</span>
        {slow && <a className={styles.openNow} href={MY_MEETING}>Open it now</a>}
      </div>
    ) : (
      <CheckInOutcome
        bare
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
          setBusy(false);
        }}
      />
    );
  }
  return (
    <>
      <QrScanner
        onScan={onScan}
        onClose={onClose}
        title="Scan A TGcode"
        note="Point the camera at a TGcode (meeting, ticket or reward) or an event’s check-in QR."
        lock={lock}
        sheet={sheet}
        sheetKey={state.kind === 'result' ? `result-${state.outcome.kind}` : state.kind}
        footer={<div className={styles.codeBar}><span>{staff ? 'Or type the 6-digit code (meeting or ticket)' : 'Or type the 6-digit code from the screen'}</span><CodeEntry dark onSubmit={(c) => void onCode(c)} busy={busy} /></div>}
      />
      {problem && (
        <div className={styles.toast} role="status"><CircleAlert size={16} aria-hidden="true" /> {problem}</div>
      )}
    </>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { CircleAlert, Check, Loader2 } from 'lucide-react';
import Dialog, { DialogActions } from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import QrScanner, { proofFromScan } from '@/app/(portal)/portal/meetings/QrScanner';
import { navigatePortal } from '@/lib/portal/portalNav';
import styles from './UniversalScanner.module.css';

// What a scan turned into, said plainly: the person always sees exactly what it did (or did not do) before anything else happens.
type Outcome =
  | { kind: 'meeting'; title: string; at: string; already: boolean }
  | { kind: 'opening'; title: string; heading: string; text: string; href: string }
  | null;

// The one camera for the portal (the middle button of the phone's bottom bar). It reads any QR the portal itself makes and does what that QR is for:
//   • a meeting's check-in QR → checks you in to that meeting, then tells you which one
//   • an event's self check-in QR (…/in/<event>) → opens that event's check-in page, which checks you in and shows the result
//   • any other page of this portal → opens it
//   • (staff only) an event ticket or a reward pickup → opens Check-In, which checks the ticket in or shows the reward to confirm
// Anything else is refused with a message, and the camera keeps looking.
// A ticket's QR (`tgt1.<event>.<ticket>.<key>`), or the older `<event>:<digits>` some phones still have cached.
const isTicketQr = (t: string) => /^tgt1\.[^\s]+\.[0-9a-f-]{36}\.[0-9a-f]{24}$/i.test(t) || /^[a-z0-9][a-z0-9_-]*:\d{6}$/i.test(t);

export default function UniversalScanner({ onClose, staff = false, redemptions = false }: { onClose: () => void; staff?: boolean; redemptions?: boolean }) {
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);
  const goTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(goTimer.current), []);   // closing the box in the moment before a page opens cancels the move
  useEffect(() => { if (!problem) return; const id = window.setTimeout(() => setProblem(''), 5000); return () => window.clearTimeout(id); }, [problem]);
  const [attempt, setAttempt] = useState(0);   // a new number restarts the camera after a check-in that did not go through

  type Target = { href: string; title: string; heading: string; text: string };
  const portalTarget = (text: string): Target | null => {
    const t = text.trim();
    // An event ticket (`<event>:<code>`) or a reward pickup (a redemption id): staff's to scan, so the Check-In page takes it from here.
    const ticket = isTicketQr(t);
    if (ticket) return staff
      ? { href: `/portal/checkin/tickets?scan=${encodeURIComponent(t)}`, title: 'Checking In A Ticket', heading: 'Event ticket', text: 'Opening Check-In, which checks this ticket in and shows who it belongs to.' }
      : null;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t)) return redemptions
      ? { href: `/portal/checkin/redemptions?r=${t}`, title: 'Looking Up A Reward', heading: 'Reward pickup', text: 'Opening the reward so you can confirm the hand-over. Nothing is marked as given until you confirm.' }
      : null;
    try {
      const u = new URL(t);
      const siteHost = /(^|\.)tritongaming\.org$/i.test(u.hostname);
      if (u.origin !== window.location.origin && !siteHost) return null;
      const ev = u.pathname.match(/^\/(?:portal\/)?in\/([^/]+)\/?$/);
      if (ev) return { href: `/portal/in/${ev[1]}`, title: 'Checking You In To The Event', heading: 'Event check-in', text: 'Opening the event’s check-in, which checks you in and shows the result.' };
      if (u.origin === window.location.origin && (u.pathname === '/portal' || u.pathname.startsWith('/portal/'))) return { href: `${u.pathname}${u.search}`, title: 'Opening The Page', heading: 'Portal page', text: 'Taking you there now.' };
    } catch { /* not a link */ }
    return null;
  };

  function onScan(text: string): boolean {
    const proof = proofFromScan(text);
    if (proof) { void checkInMeeting(proof); return true; }
    const target = portalTarget(text);
    if (target) { setProblem(''); setOutcome({ kind: 'opening', ...target }); goTimer.current = window.setTimeout(() => go(target.href), 900); return true; }
    const t = text.trim();
    if (isTicketQr(t)) setProblem('That is an event ticket. Show it to an officer, who scans it to check you in.');
    else if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t)) setProblem(staff ? 'That is a reward pickup code, and your role can’t confirm hand-overs. Ask an officer who can.' : 'That is a reward pickup code. Show it to an officer to collect your reward.');
    else setProblem('That QR code isn’t one the portal can use. Try another.');
    return false;
  }

  async function checkInMeeting(proof: object) {
    setBusy(true); setProblem('');
    try {
      const res = await fetch('/api/meetings/check-in', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(proof) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setProblem(json.error || 'Check-in failed.'); setAttempt((n) => n + 1); return; }
      setOutcome({ kind: 'meeting', title: json.title, at: json.checked_in_at, already: !!json.already });
      window.dispatchEvent(new Event('tg:meetings-changed'));
    } catch { setProblem('No connection. Try again.'); setAttempt((n) => n + 1); }
    finally { setBusy(false); }
  }

  function go(href: string) {
    onClose();
    if (!navigatePortal(href)) window.location.assign(href);
  }

  if (outcome?.kind === 'meeting') {
    return (
      <Dialog title={outcome.already ? 'Already Checked In' : 'You’re Checked In'} onClose={onClose}>
        <div className={styles.result}>
          <span className={styles.tick}><Check size={34} strokeWidth={2.5} aria-hidden="true" /></span>
          <strong>{outcome.title}</strong>
          <span>Meeting · {new Date(outcome.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' })}</span>
        </div>
        <DialogActions><Button onClick={onClose}>Done</Button></DialogActions>
      </Dialog>
    );
  }
  if (outcome?.kind === 'opening') {
    // No extra tap: the page it points at opens by itself, after a moment to read what is happening.
    return (
      <Dialog title={outcome.title} onClose={onClose}>
        <div className={styles.result}>
          <Loader2 size={34} className={styles.spin} aria-hidden="true" />
          <strong>{outcome.heading}</strong>
          <span>{outcome.text}</span>
        </div>
      </Dialog>
    );
  }
  return (
    <>
      <QrScanner
        key={attempt}
        onScan={onScan}
        onClose={onClose}
        title="Scan A QR Code"
        note="Meeting and event check-in codes work here. Point the camera at the QR and zoom in if it is far away."
      />
      {(problem || busy) && (
        <div className={styles.toast} role="status">
          {busy ? 'Checking you in…' : <><CircleAlert size={16} aria-hidden="true" /> {problem}</>}
        </div>
      )}
    </>
  );
}

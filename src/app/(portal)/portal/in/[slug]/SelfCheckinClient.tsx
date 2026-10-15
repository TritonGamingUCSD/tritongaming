'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { CircleCheck, TriangleAlert, Loader2, MapPin } from 'lucide-react';
import Button from '@/components/ui/Button';
import { fetchWithRetry } from '@/lib/ui/fetchWithRetry';
import { PACIFIC_TZ } from '@/lib/core/timezone';
import AsFormButton from '../../tickets/AsFormButton';
import styles from './selfCheckin.module.css';

interface Props {
  event: { id: string; title: string; location: string | null; start: string; closed: { code: string; message: string } | null; requiresForm: boolean };
  person: { name: string; avatar: string | null };
  asFormUrl: string | null;
  slug: string;
}

type State =
  | { kind: 'working' }
  | { kind: 'in'; ticketId: string | null; already: boolean; day: { day: number; total: number } | null }
  | { kind: 'problem'; code: string; message: string };

// Checks the signed-in person in as soon as the page opens (the QR already says that is what they want). Everything is decided by the API; this page only
// shows the result. The "checked in" card has their name and photo and a ticking clock with seconds, so staff can match it to the person and a screenshot
// stands out.
export default function SelfCheckinClient({ event, person, asFormUrl, slug }: Props) {
  const [state, setState] = useState<State>(event.closed ? { kind: 'problem', code: event.closed.code, message: event.closed.message } : { kind: 'working' });
  const [formOpened, setFormOpened] = useState(false);
  const started = useRef(false);

  const run = useCallback(async () => {
    setState({ kind: 'working' });
    try {
      const res = await fetchWithRetry('/api/checkin/self', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ event_id: event.id }) });
      const j = await res.json().catch(() => ({}));
      if (res.ok && (j.status === 'checked_in' || j.status === 'already')) {
        setState({ kind: 'in', ticketId: j.ticket_id ?? null, already: j.status === 'already', day: j.day ?? null });
      } else {
        setState({ kind: 'problem', code: j.code ?? 'error', message: j.error ?? 'Something went wrong. Please try again, or see a staff member.' });
      }
    } catch {
      setState({ kind: 'problem', code: 'network', message: 'No connection. Check your signal and try again.' });
    }
  }, [event.id]);

  useEffect(() => {
    if (event.closed || started.current) return;
    started.current = true;
    void run();
  }, [event.closed, run]);

  return (
    <div className={styles.page}>
      <p className={styles.kicker}>Self check-in</p>
      <h1 className={styles.title}>{event.title}</h1>
      {event.location && <p className={styles.where}><MapPin size={14} aria-hidden="true" /> {event.location}</p>}

      {state.kind === 'working' && (
        <div className={styles.card} role="status">
          <Loader2 className={styles.spin} size={34} aria-hidden="true" />
          <p className={styles.big}>Checking you in…</p>
        </div>
      )}

      {state.kind === 'in' && (
        <div className={`${styles.card} ${styles.ok}`} role="status">
          <CircleCheck size={44} aria-hidden="true" />
          <p className={styles.big}>{state.already ? "You're checked in" : "You're checked in!"}</p>
          {state.day && <p className={styles.note}>Day {state.day.day} of {state.day.total}</p>}
          <div className={styles.who}>
            {person.avatar
              ? <Image src={person.avatar} alt="" width={64} height={64} className={styles.avatar} unoptimized />
              : <span className={styles.avatarFallback} aria-hidden="true">{person.name.slice(0, 1).toUpperCase()}</span>}
            <span className={styles.name}>{person.name}</span>
          </div>
          <LiveClock />
          {event.requiresForm && state.ticketId && asFormUrl && (
            <div className={styles.form}>
              <p className={styles.note}>One more step for this event: fill in the AS Form and keep the &ldquo;response recorded&rdquo; screen handy for the door.</p>
              <AsFormButton ticketId={state.ticketId} url={asFormUrl} opened={formOpened} onOpened={() => setFormOpened(true)} />
            </div>
          )}
          {event.requiresForm && !asFormUrl && <p className={styles.note}>Open My Tickets to finish the AS Form step.</p>}
          <Link href="/portal/tickets" className={styles.link}>Open My Tickets</Link>
        </div>
      )}

      {state.kind === 'problem' && (
        <div className={`${styles.card} ${styles.bad}`} role="alert">
          <TriangleAlert size={40} aria-hidden="true" />
          <p className={styles.big}>{state.code === 'needs_profile' ? 'Finish your profile first' : state.code === 'needs_payment' ? 'Get your ticket first' : "Couldn't check you in"}</p>
          <p className={styles.note}>{state.code === 'needs_profile' ? 'We need a few details to count you in: your name, gender and pronouns, plus year, college and major for UCSD students. It takes a minute, then you come straight back here.' : state.message}</p>
          <div className={styles.actions}>
            {state.code === 'needs_profile' && <Link href={`/portal/profile?next=${encodeURIComponent(`/portal/in/${slug}`)}`} className={styles.primaryLink}>Finish profile</Link>}
            {state.code === 'needs_payment' && <Link href="/portal/tickets" className={styles.primaryLink}>Go to My Tickets</Link>}
            {!event.closed && state.code !== 'ended' && state.code !== 'ucsd_only' && state.code !== 'closed' && state.code !== 'day_over' && (
              <Button variant="secondary" onClick={() => void run()}>Try again</Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Ticks every second, in Pacific time like the rest of the portal.
function LiveClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className={styles.clock} aria-hidden="true">
      <span className={styles.dot} />
      {now ? now.toLocaleTimeString('en-US', { timeZone: PACIFIC_TZ, hour: 'numeric', minute: '2-digit', second: '2-digit' }) : ' '}
    </div>
  );
}

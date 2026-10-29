'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { CircleCheck, TriangleAlert, Loader2, MapPin, GraduationCap, Check } from 'lucide-react';
import Button from '@/components/ui/Button';
import { createClient } from '@/lib/supabase/client';
import { fetchWithRetry } from '@/lib/ui/fetchWithRetry';
import { PACIFIC_TZ } from '@/lib/core/timezone';
import AsFormButton from '../../tickets/AsFormButton';
import styles from './selfCheckin.module.css';

type Gate = { kind: 'closed'; code: string; message: string } | { kind: 'ucsd_only'; email: string | null } | null;

interface Props {
  event: { id: string; title: string; location: string | null; requiresForm: boolean };
  gate: Gate;
  person: { name: string; avatar: string | null };
  asFormUrl: string | null;
  slug: string;
}

type State =
  { kind: 'working' } | { kind: 'in'; ticketId: string | null; already: boolean; day: { day: number; total: number } | null } | { kind: 'problem'; code: string; message: string };

// What the person sees after scanning the QR. The server decides first whether anything stands in the way (event not open, a non-UCSD account on a UCSD-only
// event, a profile that is not finished); only when nothing does, the page checks them in straight away. Everything else is the API's call, this page only
// shows the result. The "checked in" card has their name and photo and a ticking clock with seconds, so staff can match it to the person and a screenshot
// stands out. When the event needs the AS Form, the form is the one thing on the screen to do next.
export default function SelfCheckinClient({ event, gate, person, asFormUrl, slug }: Props) {
  const [state, setState] = useState<State>(gate?.kind === 'closed' ? { kind: 'problem', code: gate.code, message: gate.message } : { kind: 'working' });
  const [formOpened, setFormOpened] = useState(false);
  const started = useRef(false);
  const [slow, setSlow] = useState(false); // checking for a while: say so, so a weak signal never looks like a frozen screen
  useEffect(() => {
    if (state.kind !== 'working') {
      setSlow(false);
      return;
    }
    const id = window.setTimeout(() => setSlow(true), 3000);
    return () => window.clearTimeout(id);
  }, [state.kind]);
  const here = `/portal/in/${slug}`;

  const run = useCallback(async () => {
    setState({ kind: 'working' });
    try {
      const res = await fetchWithRetry(
        '/api/checkin/self',
        { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ event_id: event.id }) },
        3,
        10_000,
      ); // a try that has not answered in 10 s is given up, so a stalled connection ends in "try again" instead of waiting for ever
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
    if (gate || started.current) return;
    started.current = true;
    void run();
  }, [gate, run]);

  const showForm = event.requiresForm;

  return (
    <div className={styles.page}>
      <p className={styles.kicker}>Self check-in</p>
      <h1 className={styles.title}>{event.title}</h1>
      {event.location && (
        <p className={styles.where}>
          <MapPin size={14} aria-hidden="true" /> {event.location}
        </p>
      )}

      {gate?.kind === 'ucsd_only' && <UcsdOnly email={gate.email} here={here} />}

      {!gate && state.kind === 'working' && (
        <div className={styles.card} role="status">
          <Loader2 className={styles.spin} size={34} aria-hidden="true" />
          <p className={styles.big}>Checking you in to {event.title}…</p>
          {slow && <p className={styles.note}>The connection is slow. Still trying…</p>}
        </div>
      )}

      {state.kind === 'in' && (
        <div className={`${styles.card} ${styles.ok}`} role="status">
          {showForm && !formOpened ? (
            <>
              <p className={styles.badge}>
                <Check size={14} aria-hidden="true" /> Checked in
              </p>
              <p className={styles.big}>One last step</p>
              <p className={styles.note}>This event needs the AS Form. Fill it in, then keep the &ldquo;response recorded&rdquo; screen open for the door.</p>
              {asFormUrl && state.ticketId ? (
                <div className={styles.formStep}>
                  <AsFormButton ticketId={state.ticketId} url={asFormUrl} opened={false} onOpened={() => setFormOpened(true)} />
                </div>
              ) : (
                <Link href="/portal/tickets" className={styles.primaryLink}>
                  Open My Tickets to finish
                </Link>
              )}
            </>
          ) : (
            <>
              <CircleCheck size={44} aria-hidden="true" />
              <p className={styles.big}>{showForm ? "You're all set" : state.already ? "You're checked in" : "You're checked in!"}</p>
              {state.day && (
                <p className={styles.note}>
                  Day {state.day.day} of {state.day.total}
                </p>
              )}
              {showForm && <p className={styles.note}>Keep the &ldquo;response recorded&rdquo; screen open for the door.</p>}
            </>
          )}
          <div className={styles.who}>
            {person.avatar ? (
              <Image src={person.avatar} alt="" width={64} height={64} className={styles.avatar} unoptimized />
            ) : (
              <span className={styles.avatarFallback} aria-hidden="true">
                {person.name.slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className={styles.name}>{person.name}</span>
          </div>
          <LiveClock />
          {showForm && formOpened && asFormUrl && state.ticketId && <AsFormButton ticketId={state.ticketId} url={asFormUrl} opened onOpened={() => setFormOpened(true)} />}
          <Link href="/portal/tickets" className={styles.link}>
            Open My Tickets
          </Link>
        </div>
      )}

      {state.kind === 'problem' && (
        <div className={`${styles.card} ${styles.bad}`} role="alert">
          <TriangleAlert size={40} aria-hidden="true" />
          <p className={styles.big}>
            {state.code === 'needs_payment' ? 'Get your ticket first' : state.code === 'network' || state.code === 'error' ? "Couldn't check you in" : 'Check-in is closed'}
          </p>
          <p className={styles.note}>
            {state.code === 'needs_payment' ? 'This event has a ticket price for guests. Get your ticket from My Tickets, then scan the code again.' : state.message}
          </p>
          <div className={styles.actions}>
            {state.code === 'needs_payment' && (
              <Link href="/portal/tickets" className={styles.primaryLink}>
                Go to My Tickets
              </Link>
            )}
            {(state.code === 'network' || state.code === 'error') && (
              <Button variant="secondary" onClick={() => void run()}>
                Try again
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function UcsdOnly({ email, here }: { email: string | null; here: string }) {
  const [busy, setBusy] = useState(false);
  async function switchAccount() {
    setBusy(true);
    try {
      await createClient().auth.signOut();
    } catch {
      /* the login page still opens */
    }
    window.location.href = `/login?next=${encodeURIComponent(here)}`;
  }
  return (
    <div className={`${styles.card} ${styles.bad}`} role="alert">
      <GraduationCap size={40} aria-hidden="true" />
      <p className={styles.big}>This event is for UCSD students</p>
      <p className={styles.note}>
        {email ? (
          <>
            You&apos;re signed in as <strong>{email}</strong>, which isn&apos;t a UCSD account.
          </>
        ) : (
          <>The account you&apos;re signed in with isn&apos;t a UCSD account.</>
        )}{' '}
        Only UCSD accounts (<strong>@ucsd.edu</strong>) can check in to this event.
      </p>
      <div className={styles.actions}>
        <Button onClick={() => void switchAccount()} loading={busy}>
          Sign in with a UCSD account
        </Button>
        <Link href="/portal/profile?tab=security" className={styles.link}>
          Or add my UCSD email to this account
        </Link>
      </div>
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

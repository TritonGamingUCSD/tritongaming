'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Ticket } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getAttributionSource } from '@/lib/site/attribution';
import SignInDialog from '@/components/auth/SignInDialog';
import styles from './event-detail.module.css';

// The ticket button on a public event page, aware of who is looking: signed out it opens a sign-in popup and returns to this page; signed in without a ticket it gets one right here (or sends them to pay, or to finish their profile);
// with a ticket it says so and opens the ticket. The page itself stays cached and the same for everyone; this part checks the person in the browser.
export default function EventTicketButton({ eventId, label, sub }: { eventId: string; label: string; sub?: string | null }) {
  const router = useRouter();
  const [state, setState] = useState<'loading' | 'out' | 'in' | 'has'>('loading');
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [signIn, setSignIn] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!alive) return;
      if (!user || user.is_anonymous) return setState('out');
      const { data } = await supabase.from('tickets').select('id, status').eq('event_id', eventId).eq('user_id', user.id).neq('status', 'cancelled').maybeSingle();
      if (!alive) return;
      if (data) {
        setTicketId(data.id as string);
        setState('has');
      } else setState('in');
    })().catch(() => {
      if (alive) setState('out');
    });
    return () => {
      alive = false;
    };
  }, [eventId]);

  async function getTicket() {
    setWorking(true);
    setMsg('');
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventId, source: getAttributionSource() }),
      });
      const data = await res.json();
      if (res.status === 409 && /already registered/i.test(data.error ?? '')) {
        setState('has');
        return;
      }
      if (!res.ok) {
        if (data.needsProfile) {
          router.push(`/portal/finish-profile?next=/me/tickets&mode=ticket&event=${eventId}`);
          return;
        }
        setMsg(data.error || 'Something went wrong. Please try again.');
        return;
      }
      if (data.url) {
        window.location.href = data.url; // off to the payment page
        return;
      }
      if (data.ticket?.id) setTicketId(data.ticket.id);
      setState('has');
    } catch {
      setMsg('Could not reach the site. Check your connection and try again.');
    } finally {
      setWorking(false);
    }
  }

  const stub = (text: React.ReactNode, small?: React.ReactNode) => (
    <>
      <span className={styles.stubLeft}>
        <Ticket size={20} strokeWidth={1.75} aria-hidden="true" />
      </span>
      <span className={styles.stubRight}>
        {text}
        {small && <small>{small}</small>}
      </span>
    </>
  );

  return (
    <>
      {state === 'has' ? (
        <Link href={ticketId ? `/me/tickets?qr=${ticketId}` : '/me/tickets'} className={styles.ticketBtn}>
          {stub("You're going", 'Show your ticket')}
        </Link>
      ) : (
        <button type="button" className={styles.ticketBtn} disabled={state === 'loading' || working} onClick={() => (state === 'out' ? setSignIn(true) : getTicket())}>
          {stub(working ? 'Getting your ticket…' : label, sub)}
        </button>
      )}
      {msg && (
        <p role="alert" style={{ margin: '0.5rem 0 0', color: '#ffb4b4' }}>
          {msg}
        </p>
      )}
      {signIn && <SignInDialog next={window.location.pathname} reason="Sign in to get your ticket. It only takes a moment." onClose={() => setSignIn(false)} />}
    </>
  );
}

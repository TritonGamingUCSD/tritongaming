'use client';

import { useState } from 'react';
import Link from 'next/link';
import { getAttributionSource } from '@/lib/site/attribution';
import styles from './events.module.css';

// Register for an event from the list, without leaving it. The same rules as everywhere (profile first, payment for a priced public event).
export default function QuickRegister({ eventId }: { eventId: string }) {
  const [state, setState] = useState<'idle' | 'working' | 'done'>('idle');
  const [msg, setMsg] = useState('');
  async function go() {
    setState('working');
    setMsg('');
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventId, source: getAttributionSource() }),
      });
      const data = await res.json();
      if (res.status === 409) return setState('done');
      if (!res.ok) {
        if (data.needsProfile) return void (window.location.href = `/portal/finish-profile?next=/me/events&mode=ticket&event=${eventId}`);
        setMsg(data.error || 'Something went wrong. Please try again.');
        return setState('idle');
      }
      if (data.url) return void (window.location.href = data.url);
      setState('done');
    } catch {
      setMsg('Could not reach the site. Try again.');
      setState('idle');
    }
  }
  if (state === 'done')
    return (
      <Link href="/me/tickets" className={`${styles.show} ${styles.going}`}>
        You’re going ✓
      </Link>
    );
  return (
    <div className={styles.reg}>
      <button type="button" className={styles.btn} disabled={state === 'working'} onClick={go}>
        {state === 'working' ? 'Getting…' : 'Register'}
      </button>
      {msg && <small role="alert">{msg}</small>}
    </div>
  );
}

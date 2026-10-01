'use client';

import Notice from '@/components/ui/Notice';
import { useEffect, useRef, useState } from 'react';
import styles from './checkinsection.module.css';

interface Event { id: string; title: string; start_date: string; }

// Officer-facing half of online self-check-in — reveals the current code
// to relay in Discord/Zoom chat. See PointsSectionContent... actually see
// api/checkin/online for the member-facing side that verifies it, and
// rotatingCode.ts for why this rotates slowly (5 min) and why rotation
// speed isn't actually the anti-sharing mechanism (ticket ownership is).
export default function OnlineCheckinPanel({ events }: { events: Event[] }) {
  const [eventId, setEventId] = useState(events[0]?.id ?? '');
  const [code, setCode] = useState('');
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [error, setError] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function loadCode() {
    if (!eventId) return;
    try {
      const res = await fetch(`/api/checkin/online/${eventId}/code`);
      const json = await res.json();
      if (!res.ok) { setError(json.error || 'Failed to load code.'); return; }
      setError('');
      setCode(json.code);
      setSecondsRemaining(json.secondsRemaining);
    } catch {
      setError('Network error loading code.');
    }
  }

  useEffect(() => {
    setCode('');
    loadCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setSecondsRemaining((s) => {
        if (s <= 1) { loadCode(); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  if (events.length === 0) {
    return <p className={styles.onlineHint}>No upcoming events to check people into.</p>;
  }

  return (
    <div className={styles.onlinePanel}>
      <select className={styles.eventSelect} value={eventId} onChange={(e) => setEventId(e.target.value)}>
        {events.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
      </select>

      <p className={styles.onlineHint}>
        Post this code in Discord/Zoom chat — attendees enter it themselves under their own ticket in the portal.
        Only works for people who already have a ticket for this event.
      </p>

      {error && <Notice tone="error">{error}</Notice>}

      {code && (
        <div className={styles.codeCard}>
          <div className={styles.codeValue}>{code}</div>
          <div className={styles.codeTimer}>Refreshes in {secondsRemaining}s</div>
        </div>
      )}
    </div>
  );
}

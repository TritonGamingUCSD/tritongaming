'use client';

import { useEffect, useState } from 'react';
import { Camera, Settings2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import Loading from '@/components/Loading/Loading';
import { formatPacificDate } from '@/lib/core/timezone';
import { call, eventKey, type BoothEventRow } from './api';
import styles from './photobooth.module.css';

// The events a booth can be set up for, newest first: Set Up opens the booth's settings, Open Booth runs it on this screen.
export function BoothsTab({ onOpen, onRun }: { onOpen: (event: string) => void; onRun: (event: string) => void }) {
  const [events, setEvents] = useState<BoothEventRow[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    void (async () => {
      const r = await call<{ events: BoothEventRow[] }>('/api/photobooth/booths');
      if (r.ok) setEvents(r.data.events);
      else setError(r.error);
    })();
  }, []);
  if (error) return <Notice tone="error">{error}</Notice>;
  if (!events) return <Loading label="Loading events…" />;
  if (!events.length) return <p className={styles.empty}>There are no events yet. Make an event first, then set up its booth here.</p>;
  return (
    <ul className={styles.list}>
      {events.map((e) => (
        <li key={e.id} className={styles.row}>
          <div className={styles.rowMain}>
            <strong>{e.title}</strong>
            <span className={styles.meta}>
              {formatPacificDate(e.start_date, { weekday: true, year: true })}
              {e.hasBooth ? ' · Booth ready' : ' · No booth yet'}
              {e.photos > 0 ? ` · ${e.photos} photo${e.photos === 1 ? '' : 's'} waiting to be downloaded` : ''}
            </span>
          </div>
          <div className={styles.rowActions}>
            <Button size="sm" variant="secondary" onClick={() => onOpen(eventKey(e))}>
              <Settings2 size={15} aria-hidden="true" /> Set Up
            </Button>
            <Button size="sm" onClick={() => onRun(eventKey(e))} disabled={!e.hasBooth} title={e.hasBooth ? undefined : 'Set the booth up first'}>
              <Camera size={15} aria-hidden="true" /> Open Booth
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}

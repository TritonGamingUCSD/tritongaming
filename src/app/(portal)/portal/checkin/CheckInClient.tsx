'use client';

import { useState } from 'react';
import QRScanner from '@/components/tickets/QRScanner';
import styles from './checkin.module.css';

interface Event {
  id: string;
  title: string;
  start_date: string;
}

export default function CheckInClient({ events }: { events: Event[] }) {
  const [selectedEventId, setSelectedEventId] = useState(events[0]?.id || '');

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Check-In Scanner</h1>
      <p className={styles.subtitle}>
        Select an event, then scan or manually enter attendee QR codes.
      </p>

      {events.length === 0 ? (
        <div className={styles.noEvents}>
          No active events found. Events appear here within 24 hours of their start time.
        </div>
      ) : (
        <div className={styles.layout}>
          <div className={styles.eventSelector}>
            <label className={styles.label}>Select Event</label>
            <select
              className={styles.select}
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
            >
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title} —{' '}
                  {new Date(event.start_date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </option>
              ))}
            </select>
          </div>

          {selectedEventId && <QRScanner eventId={selectedEventId} />}
        </div>
      )}
    </div>
  );
}

'use client';

import Link from 'next/link';
import FullscreenQR from './tickets/FullscreenQR';
import { useState } from 'react';
import { Clock, MapPin, QrCode } from 'lucide-react';
import { PACIFIC_TZ, pacificDaysUntil, formatEventDateRange, eventDayProgress } from '@/lib/timezone';
import styles from './dashboard.module.css';

interface Ticket {
  id: string;
  status: string;
  event: { id: string; title: string; start_date: string; end_date?: string | null; location: string | null } | null;
}

export default function DashboardClient({ ticket }: { ticket: Ticket }) {
  const [showQR, setShowQR] = useState(false);
  const ev = ticket.event;
  if (!ev) return null;

  const d = new Date(ev.start_date);
  const daysUntil = pacificDaysUntil(ev.start_date);
  const progress = eventDayProgress(ev.start_date, ev.end_date);

  return (
    <>
      <section className={styles.ticketHeroCard}>
        <div className={styles.ticketHeroInner}>
          <div className={styles.ticketHeroMeta}>
            <span className={styles.ticketHeroLabel}>
              {progress ? (
                <><span className={styles.liveDot} aria-hidden="true" /> DAY {progress.day} OF {progress.total}</>
              ) : daysUntil === 0 ? (
                <><span className={styles.liveDot} aria-hidden="true" /> TODAY</>
              ) : daysUntil === 1 ? (
                <><Clock size={11} strokeWidth={1.5} aria-hidden="true" /> TOMORROW</>
              ) : (
                `IN ${daysUntil} DAYS`
              )}
            </span>
            <h2 className={styles.ticketHeroTitle}>{ev.title}</h2>
            <p className={styles.ticketHeroDate}>
              {formatEventDateRange(ev.start_date, ev.end_date, { weekday: true })}
              {' · '}
              {d.toLocaleTimeString('en-US', { timeZone: PACIFIC_TZ, hour: 'numeric', minute: '2-digit' })}
            </p>
            {ev.location && (
              <p className={styles.ticketHeroLoc}><MapPin size={12} strokeWidth={1.5} aria-hidden="true" /> {ev.location}</p>
            )}
          </div>
          <div className={styles.ticketHeroActions}>
            <button className={styles.showQrHeroBtn} onClick={() => setShowQR(true)}>
              <QrCode size={16} strokeWidth={1.5} aria-hidden="true" /> Show QR Code
            </button>
            <Link href="/portal?section=tickets" className={styles.viewAllTickets}>All tickets →</Link>
          </div>
        </div>
        <div className={styles.ticketHeroGlow} aria-hidden="true" />
      </section>

      {showQR && (
        <FullscreenQR
          ticketId={ticket.id}
          eventTitle={ev.title}
          eventDate={ev.start_date}
          eventLocation={ev.location}
          onClose={() => setShowQR(false)}
        />
      )}
    </>
  );
}

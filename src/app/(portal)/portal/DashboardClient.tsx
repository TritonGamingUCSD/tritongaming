'use client';

import Link from 'next/link';
import FullscreenQR from './tickets/FullscreenQR';
import { useState } from 'react';
import { Clock, MapPin, Smartphone } from 'lucide-react';
import { PACIFIC_TZ } from '@/lib/timezone';
import styles from './dashboard.module.css';

interface Ticket {
  id: string;
  status: string;
  event: { id: string; title: string; start_date: string; location: string | null } | null;
}

export default function DashboardClient({ ticket }: { ticket: Ticket }) {
  const [showQR, setShowQR] = useState(false);
  const ev = ticket.event;
  if (!ev) return null;

  const d = new Date(ev.start_date);
  const daysUntil = Math.ceil((d.getTime() - Date.now()) / 86400_000);

  return (
    <>
      <section className={styles.ticketHeroCard}>
        <div className={styles.ticketHeroInner}>
          <div className={styles.ticketHeroMeta}>
            <span className={styles.ticketHeroLabel}>
              {daysUntil === 0 ? (
                <><span className={styles.liveDot} aria-hidden="true" /> TODAY</>
              ) : daysUntil === 1 ? (
                <><Clock size={11} strokeWidth={1.5} aria-hidden="true" /> TOMORROW</>
              ) : (
                `IN ${daysUntil} DAYS`
              )}
            </span>
            <h2 className={styles.ticketHeroTitle}>{ev.title}</h2>
            <p className={styles.ticketHeroDate}>
              {d.toLocaleDateString('en-US', { timeZone: PACIFIC_TZ, weekday: 'long', month: 'long', day: 'numeric' })}
              {' · '}
              {d.toLocaleTimeString('en-US', { timeZone: PACIFIC_TZ, hour: 'numeric', minute: '2-digit' })}
            </p>
            {ev.location && (
              <p className={styles.ticketHeroLoc}><MapPin size={12} strokeWidth={1.5} aria-hidden="true" /> {ev.location}</p>
            )}
          </div>
          <div className={styles.ticketHeroActions}>
            <button className={styles.showQrHeroBtn} onClick={() => setShowQR(true)}>
              <Smartphone size={16} strokeWidth={1.5} aria-hidden="true" /> Show QR Code
            </button>
            <Link href="/portal?open=tickets" className={styles.viewAllTickets}>All tickets →</Link>
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

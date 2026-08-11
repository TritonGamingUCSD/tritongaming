'use client';

import Link from 'next/link';
import FullscreenQR from './tickets/FullscreenQR';
import { useState } from 'react';
import styles from './dashboard.module.css';

interface Ticket {
  id: string;
  ticket_code: string;
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
              {daysUntil === 0 ? '🔴 TODAY' : daysUntil === 1 ? '⏰ TOMORROW' : `IN ${daysUntil} DAYS`}
            </span>
            <h2 className={styles.ticketHeroTitle}>{ev.title}</h2>
            <p className={styles.ticketHeroDate}>
              {d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              {' · '}
              {d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </p>
            {ev.location && (
              <p className={styles.ticketHeroLoc}>📍 {ev.location}</p>
            )}
          </div>
          <div className={styles.ticketHeroActions}>
            <button className={styles.showQrHeroBtn} onClick={() => setShowQR(true)}>
              <span>📱</span> Show QR Code
            </button>
            <Link href="/portal/tickets" className={styles.viewAllTickets}>All tickets →</Link>
          </div>
        </div>
        <div className={styles.ticketHeroGlow} aria-hidden="true" />
      </section>

      {showQR && (
        <FullscreenQR
          ticketCode={ticket.ticket_code}
          eventTitle={ev.title}
          onClose={() => setShowQR(false)}
        />
      )}
    </>
  );
}

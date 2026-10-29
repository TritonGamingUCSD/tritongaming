'use client';

import Link from '@/components/portal/NoPrefetchLink';
import { ChevronRight, Clock, Ticket } from 'lucide-react';
import { pacificDaysUntil, eventDayProgress, formatPacificDate, formatPacificTime } from '@/lib/core/timezone';
import styles from './dashboard.module.css';

interface TicketInfo {
  id: string;
  status: string;
  event: { id: string; title: string; start_date: string; end_date?: string | null; location: string | null } | null;
}

// A small reminder of the next event you have a ticket for (the QR code itself lives in My Tickets, one tap away).
export default function DashboardClient({ ticket }: { ticket: TicketInfo }) {
  const ev = ticket.event;
  if (!ev) return null;

  const daysUntil = pacificDaysUntil(ev.start_date);
  const progress = eventDayProgress(ev.start_date, ev.end_date);
  const when = progress ? `Day ${progress.day} of ${progress.total}` : daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `In ${daysUntil} days`;
  const live = !!progress || daysUntil === 0;
  const day = formatPacificDate(ev.start_date, { weekday: true });
  const time = formatPacificTime(ev.start_date);

  return (
    <Link href="/portal/tickets" className={styles.nextReminder} aria-label={`Next event: ${ev.title}, ${when}. Open your tickets`}>
      <span className={`${styles.nextReminderIcon} ${live ? styles.nextReminderLive : ''}`} aria-hidden="true">
        {live ? <span className={styles.liveDot} /> : <Ticket size={16} strokeWidth={1.75} />}
      </span>
      <span className={styles.nextReminderText}>
        <span className={styles.nextReminderTitle}>{ev.title}</span>
        <span className={styles.nextReminderSub}>
          {!live && <Clock size={11} strokeWidth={1.75} aria-hidden="true" />}
          <strong>{when}</strong> · {day} · {time}
        </span>
      </span>
      <ChevronRight size={16} strokeWidth={1.75} className={styles.nextReminderGo} aria-hidden="true" />
    </Link>
  );
}

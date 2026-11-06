'use client';

import { useState } from 'react';
import ByteMini from '@/components/Bytecode/ByteMini';
import { Ticket, CircleCheck } from 'lucide-react';
import { formatPacificDateTime } from '@/lib/core/timezone';
import styles from './activity.module.css';
import SectionHeader from '@/components/ui/SectionHeader';

interface ActivityTicket {
  id: string;
  status: 'active' | 'used' | 'cancelled' | 'expired';
  checked_in_at: string | null;
  created_at: string;
  event: { id: string; title: string } | null;
}

interface ActivityItem {
  key: string;
  icon: 'registered' | 'checked_in';
  title: string;
  eventTitle: string;
  at: string;
}

// Built straight from the same tickets query the "My Tickets" section already
// fetches (getTicketsData.ts) — no separate query needed, since a
// registration and a check-in are both just fields already sitting on each
// ticket row.
function buildTimeline(tickets: ActivityTicket[]): ActivityItem[] {
  const items: ActivityItem[] = [];
  for (const t of tickets) {
    if (!t.event) continue;
    items.push({ key: `${t.id}-registered`, icon: 'registered', title: 'Got a ticket', eventTitle: t.event.title, at: t.created_at });
    if (t.checked_in_at) {
      items.push({ key: `${t.id}-checkedin`, icon: 'checked_in', title: 'Checked in', eventTitle: t.event.title, at: t.checked_in_at });
    }
  }
  return items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

export default function ActivitySectionContent({ tickets, embedded = false, popup = false }: { tickets: ActivityTicket[]; embedded?: boolean; popup?: boolean }) {
  const all = buildTimeline(tickets);
  // Under the tickets only the latest few show at first; the full list is one tap away.
  const [showAll, setShowAll] = useState(false);
  const items = embedded && !popup && !showAll ? all.slice(0, 5) : all;

  if (items.length === 0) {
    return (
      <div className={styles.empty}>
        <span className={styles.emptyIcon}>
          <span style={{ display: 'block', width: 96 }}>
            <ByteMini pose="sleep" />
          </span>
        </span>
        <h2 className={styles.emptyTitle}>No activity yet</h2>
        <p className={styles.emptySub}>Grab a ticket to an event and it'll show up here.</p>
      </div>
    );
  }

  return (
    <div className={`${styles.page} ${embedded ? styles.pageEmbedded : ''}`}>
      {popup ? null : embedded ? <h2 className={styles.embeddedTitle}>History</h2> : <SectionHeader title="Activity" flush sub="Your tickets and check-ins, newest first." />}
      <ol className={styles.timeline}>
        {items.map((item) => (
          <li key={item.key} className={styles.item}>
            <span className={`${styles.itemIcon} ${item.icon === 'checked_in' ? styles.itemIconSuccess : ''}`} aria-hidden="true">
              {item.icon === 'checked_in' ? <CircleCheck size={16} strokeWidth={1.75} /> : <Ticket size={16} strokeWidth={1.75} />}
            </span>
            <div>
              <div className={styles.itemTitle}>
                {item.title} — {item.eventTitle}
              </div>
              <div className={styles.itemTime}>{formatPacificDateTime(item.at)}</div>
            </div>
          </li>
        ))}
      </ol>
      {embedded && !popup && all.length > 5 && (
        <button type="button" className={styles.more} onClick={() => setShowAll((v) => !v)}>
          {showAll ? 'Show less' : `Show all ${all.length}`}
        </button>
      )}
    </div>
  );
}

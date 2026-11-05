'use client';

import { useEffect, useState } from 'react';
import Link from '@/components/portal/PortalLink';
import { CalendarDays, MapPin } from 'lucide-react';
import { formatPacificDateTime } from '@/lib/core/timezone';
import type { DivisionHat } from '@/components/portal/hubTypes';
import type { DivisionEventRow } from '@/app/api/divisions/[id]/events/route';
import styles from './division.module.css';

// The division's next event on its Home: when, how many have registered and checked in so far, and the buttons that matter (its public page where people get a ticket, and the check-in desk).
export default function DivisionNextEvent({ hat }: { hat: DivisionHat }) {
  const [next, setNext] = useState<DivisionEventRow | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    fetch(`/api/divisions/${hat.id}/events`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { events: [] }))
      .then((j) => {
        if (!live) return;
        const now = Date.now();
        const upcoming = (j.events as DivisionEventRow[])
          .filter((e) => new Date(e.end_date ?? e.start_date).getTime() >= now)
          .sort((a, b) => a.start_date.localeCompare(b.start_date));
        setNext(upcoming[0] ?? null);
      })
      .catch(() => live && setNext(null));
    return () => {
      live = false;
    };
  }, [hat.id]);
  if (next === undefined) return null;
  const canManage = hat.level === 'head' || hat.level === 'staff';
  if (!next)
    return (
      <section className={styles.next} aria-label="Next event">
        <span className={styles.nextTag}>Next event</span>
        <p className={styles.nextNone}>Nothing planned yet.{canManage ? ' Create the next event from the Events page.' : ''}</p>
        {canManage && (
          <Link href={`/portal/events/new?division=${hat.id}`} className={styles.nextBtn}>
            Create Event
          </Link>
        )}
      </section>
    );
  const publicHref = next.slug ? `/events/${next.slug}` : '/events';
  return (
    <section className={styles.next} aria-label="Next event">
      <span className={styles.nextTag}>Next event{next.is_published ? '' : ' · draft'}</span>
      <h3 className={styles.nextTitle}>{next.title}</h3>
      <p className={styles.nextMeta}>
        <CalendarDays size={14} aria-hidden="true" /> {formatPacificDateTime(next.start_date, { weekday: true })}
      </p>
      <p className={styles.nextMeta}>
        <MapPin size={14} aria-hidden="true" /> <b>{next.registered}</b> registered · <b>{next.checkedIn}</b> checked in so far
      </p>
      <div className={styles.nextActions}>
        {next.is_published && (
          <a href={publicHref} className={styles.nextBtn} target="_blank" rel="noopener noreferrer">
            Get Ticket Page
          </a>
        )}
        <Link href={`/portal/${hat.slug}/check-in`} className={styles.nextBtnAlt}>
          Check-In
        </Link>
        {canManage && (
          <Link href={`/portal/events/${next.id}`} className={styles.nextBtnAlt}>
            Edit
          </Link>
        )}
      </div>
    </section>
  );
}

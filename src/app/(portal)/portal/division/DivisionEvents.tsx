'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Plus } from 'lucide-react';
import Link from '@/components/portal/PortalLink';
import { ButtonLink } from '@/components/ui/Button';
import Loading from '@/components/Loading/Loading';
import Notice from '@/components/ui/Notice';
import { formatPacificDateTime } from '@/lib/core/timezone';
import type { DivisionHat } from '@/components/portal/hubTypes';
import type { DivisionEventRow } from '@/app/api/divisions/[id]/events/route';
import styles from './divisionEvents.module.css';

// The division's own events (and the ones it co-hosts): when, how many registered and checked in, who hosts, and shortcuts to edit, run the check-in desk and read the results.
export default function DivisionEvents({ hat }: { hat: DivisionHat }) {
  const [rows, setRows] = useState<DivisionEventRow[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    setRows(null);
    setError('');
    fetch(`/api/divisions/${hat.id}/events`, { cache: 'no-store' })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!live) return;
        if (!r.ok) setError(j.error || 'Could not load the events.');
        else setRows(j.events as DivisionEventRow[]);
      })
      .catch(() => live && setError('Network error loading the events.'));
    return () => {
      live = false;
    };
  }, [hat.id]);

  const canCreate = hat.level === 'head' || hat.level === 'staff';
  return (
    <section className={styles.wrap} aria-label={`${hat.name} events`}>
      {canCreate && (
        <div className={styles.bar}>
          <ButtonLink href={`/portal/events/new?division=${hat.id}`}>
            <Plus size={15} strokeWidth={2} aria-hidden="true" /> Create Event
          </ButtonLink>
        </div>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      {!error && !rows && <Loading variant="inline" label="Loading the events…" />}
      {rows && rows.length === 0 && <p className={styles.none}>No events yet. {canCreate ? 'Create the first one with the button above.' : ''}</p>}
      {rows && rows.length > 0 && (
        <ul className={styles.list}>
          {rows.map((e) => (
            <li key={e.id} className={styles.row}>
              <div className={styles.main}>
                <Link href={`/portal/events/${e.id}`} className={styles.title}>
                  {e.title}
                </Link>
                <span className={styles.when}>{formatPacificDateTime(e.start_date, { weekday: true })}</span>
              </div>
              <span className={`${styles.badge} ${e.is_published ? styles.live : styles.draft}`}>{e.is_published ? 'Published' : 'Draft'}</span>
              <span className={styles.numbers}>
                <b>{e.registered}</b> registered · <b>{e.checkedIn}</b> checked in
              </span>
              <span className={styles.hosts} title={e.hosts.map((h) => h.name).join(', ')}>
                {e.hosts.map((h, i) =>
                  h.logoUrl ? (
                    <Image key={i} src={h.logoUrl} alt={h.name} width={24} height={24} className={styles.hostLogo} unoptimized />
                  ) : (
                    <span key={i} className={styles.hostText}>
                      {h.tg ? 'TG' : h.name.slice(0, 1)}
                    </span>
                  ),
                )}
              </span>
              <span className={styles.actions}>
                <Link href={`/portal/events/${e.id}`}>Edit</Link>
                <Link href={`/portal/events/${e.id}`}>Check-in</Link>
                <Link href={`/portal/events/${e.id}/summary`}>Results</Link>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

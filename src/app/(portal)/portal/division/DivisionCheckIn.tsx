'use client';

import { useEffect, useState } from 'react';
import Loading from '@/components/Loading/Loading';
import Notice from '@/components/ui/Notice';
import SelfCheckinPanel from '../checkin/SelfCheckinPanel';
import { isCheckinWindowOpen } from '@/lib/events/checkinWindow';
import type { DivisionHat } from '@/components/portal/hubTypes';
import type { DivisionEventRow } from '@/app/api/divisions/[id]/events/route';
import styles from './divisionEvents.module.css';

// Check-in for a division's events: the self check-in QR for each event that can still be checked into. Members and Heads can show it; only Heads (and exec and admin) turn it on or off.
// Scanning tickets is the same scanner and code field as the club's, which now lets a division's Members and Heads check in their own division's events only.
export default function DivisionCheckIn({ hat }: { hat: DivisionHat }) {
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

  if (error) return <Notice tone="error">{error}</Notice>;
  if (!rows) return <Loading />;
  const open = rows.filter((e) => isCheckinWindowOpen(e)).sort((a, b) => a.start_date.localeCompare(b.start_date));
  if (open.length === 0) {
    return (
      <p className={styles.none}>
        There is no {hat.name} event to check people into right now. To check someone in with a 6-digit code, type it in the code field at the top of the page.
      </p>
    );
  }
  return (
    <SelfCheckinPanel
      events={open.map((e) => ({ id: e.id, title: e.title, slug: e.slug, start_date: e.start_date, end_date: e.end_date, self_checkin_mode: e.self_checkin_mode }))}
      canControl={hat.level === 'head' || hat.level === 'staff'}
    />
  );
}

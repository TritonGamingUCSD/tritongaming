'use client';

import Loading from '@/components/Loading/Loading';
import { Fragment, useEffect, useState } from 'react';
import { Repeat, MapPin } from 'lucide-react';
import Notice from '@/components/ui/Notice';
import WeekHead from '@/components/ui/WeekHead';
import { startsWeekGroup, weekGroup } from '@/lib/events/weekGroups';
import styles from './meetings.module.css';
import { WEEK_TONE, dayLabel, timeRange } from './format';
import { DocButton } from './DocButton';
import { UpcomingItem } from './types';

export function UpcomingPanel() {
  const [items, setItems] = useState<UpcomingItem[] | null>(null);
  const [openItems, setOpenItems] = useState<UpcomingItem[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/meetings/upcoming', { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok) setError(json.error || 'Failed to load.');
        else {
          setItems(json.meetings);
          setOpenItems(json.open ?? []);
        }
      } catch {
        setError('Network error.');
      }
    })();
  }, []);
  if (error) return <Notice tone="error">{error}</Notice>;
  if (!items) return <Loading label="Loading upcoming meetings…" />;
  // Their own meetings and the ones they may drop in on, together by date. The optional ones are marked so nobody thinks they must come.
  const all = [...items.map((m) => ({ ...m, optional: false })), ...openItems.map((m) => ({ ...m, optional: true }))].sort((x, y) => x.starts_at.localeCompare(y.starts_at));
  if (all.length === 0)
    return (
      <div className={styles.card}>
        <p className={styles.muted}>Nothing scheduled for you yet.</p>
      </div>
    );
  // This week and next week show; anything further out folds away.
  const soon = all.filter((m) => weekGroup(m.date) <= 1),
    later = all.filter((m) => weekGroup(m.date) > 1);
  const renderItem = (m: (typeof all)[number], i: number, shown: typeof all) => (
    <Fragment key={m.key}>
      {startsWeekGroup(
        shown.map((x) => x.date),
        i,
      ) && <WeekHead date={m.date} />}
      <li
        data-tone={m.status === 'open' ? 'open' : m.is_today ? 'today' : WEEK_TONE[weekGroup(m.date)]}
        className={`${styles.meetingCard} ${m.status === 'open' ? styles.cardOpen : ''} ${m.optional ? styles.cardOptional : ''}`}
      >
        <div className={styles.meetingMain}>
          <span className={`${styles.dateBlock} ${m.is_today ? styles.dateToday : ''}`} aria-hidden="true">
            <small>{new Date(`${m.date}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short' })}</small>
            <b>{new Date(`${m.date}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', day: 'numeric' })}</b>
          </span>
          <div className={styles.meetingInfo}>
            <strong>
              {m.title}
              {m.repeats && <Repeat size={12} aria-label="Repeats weekly" className={styles.inlineIcon} />}
            </strong>
            <span className={styles.metaLine}>
              <span>
                <strong className={styles.metaDay}>{m.is_today ? 'Today' : dayLabel(m.date).split(',')[0]}</strong> {timeRange(m.starts_at, m.ends_at)}
              </span>
              {m.location && (
                <span>
                  <MapPin size={11} aria-hidden="true" className={styles.inlineIcon} /> {m.location}
                </span>
              )}
            </span>
            {m.hosting ? (
              <span className={`${styles.metaLine} ${styles.metaSub}`}>You’re hosting</span>
            ) : m.host_name ? (
              <span className={`${styles.metaLine} ${styles.metaSub}`}>Hosted by {m.host_name}</span>
            ) : null}
          </div>
          {m.doc_url && <DocButton url={m.doc_url} label="Doc" />}
          {m.optional && (
            <span className={styles.guestTag} title="You were not added. Come if you like, you count as +1">
              Optional
            </span>
          )}
          {m.status === 'open' && <span className={`${styles.pill} ${styles.pillOpen}`}>Check-in open</span>}
        </div>
      </li>
    </Fragment>
  );
  return (
    <div className={styles.stack}>
      {openItems.length > 0 && (
        <p className={styles.optionalKey}>
          <span /> Optional meetings: you were not added, but you are welcome to come and count as +1.
        </p>
      )}
      {soon.length === 0 ? <p className={styles.muted}>Nothing this week or next.</p> : <ul className={styles.stack}>{soon.map((m, i) => renderItem(m, i, soon))}</ul>}
      {later.length > 0 && (
        <details className={styles.moreOptions}>
          <summary>
            <span>Later</span>
            <em>
              {later.length} more {later.length === 1 ? 'meeting' : 'meetings'} after next week
            </em>
          </summary>
          <div className={styles.moreBody}>
            <ul className={styles.stack}>{later.map((m, i) => renderItem(m, i, later))}</ul>
          </div>
        </details>
      )}
    </div>
  );
}

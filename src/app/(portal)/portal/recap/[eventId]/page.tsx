import { notFound, redirect } from 'next/navigation';
import Link from '@/components/portal/NoPrefetchLink';
import { Award, Images, CalendarDays, ExternalLink } from 'lucide-react';
import { getProfile, getUserRoles } from '@/lib/core/auth';
import { hasCapability, isRewardsEligible } from '@/lib/portal/capabilities';
import { createClient } from '@/lib/supabase/server';
import { openEventsFilter } from '@/lib/events/checkinWindow';
import { PACIFIC_TZ, formatEventDateRange } from '@/lib/core/timezone';
import MarkdownContent from '@/components/MarkdownContent/MarkdownContent';
import FeedbackForm from './FeedbackForm';
import styles from './recap.module.css';

export const metadata = { title: 'After the Event' };
export const dynamic = 'force-dynamic';

interface Album { title: string; url: string }

export default async function RecapPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const [profile, roles] = await Promise.all([getProfile(), getUserRoles()]);
  if (!profile) redirect('/login');

  const supabase = await createClient();
  const [{ data: event }, { data: ticket }] = await Promise.all([
    supabase.from('events').select('id, title, start_date, end_date, location, photo_albums, post_event_info, slug').eq('id', eventId).maybeSingle(),
    supabase.from('tickets').select('id, status, checked_in_at').eq('event_id', eventId).eq('user_id', profile.id).eq('status', 'used').maybeSingle(),
  ]);
  if (!event) notFound();
  // A recap is for people who were actually there (staff can preview any).
  if (!ticket && !hasCapability(roles, 'checkin')) redirect('/portal/tickets');

  const [{ data: earned }, { data: allTx }, { data: feedback }, { data: upcoming }] = await Promise.all([
    supabase.from('point_transactions').select('amount').eq('user_id', profile.id).eq('event_id', eventId).eq('type', 'event_checkin').is('reversed_at', null),
    supabase.from('point_transactions').select('amount').eq('user_id', profile.id),
    supabase.from('event_feedback').select('rating, comment').eq('event_id', eventId).eq('user_id', profile.id).maybeSingle(),
    supabase.from('events').select('id, title, start_date, slug').eq('is_published', true).or(openEventsFilter()).neq('id', eventId).order('start_date').limit(3),
  ]);

  const pointsEarned = (earned ?? []).reduce((n, r) => n + r.amount, 0);
  const balance = (allTx ?? []).reduce((n, r) => n + r.amount, 0);
  const albums = (event.photo_albums as Album[] | null) ?? [];
  const showPoints = isRewardsEligible(roles);

  return (
    <div className={styles.page}>
      <Link href="/portal/tickets" className={styles.back}>← Back to My Tickets</Link>
      <header className={styles.hero}>
        <p className={styles.kicker}>Thanks for coming!</p>
        <h1 className={styles.title}>{event.title}</h1>
        <p className={styles.sub}>
          {formatEventDateRange(event.start_date, event.end_date, { weekday: true })}
          {event.location && ` · ${event.location}`}
        </p>
      </header>

      {showPoints && ticket && pointsEarned > 0 && (
        <section className={styles.card}>
          <span className={styles.icon}><Award size={18} strokeWidth={1.75} aria-hidden="true" /></span>
          <div>
            <h2 className={styles.cardTitle}>You earned {pointsEarned} point{pointsEarned === 1 ? '' : 's'}</h2>
            <p className={styles.text}>Your balance is now {balance.toLocaleString()} points.{' '}
              <Link href="/portal/rewards" className={styles.link}>Browse rewards</Link></p>
          </div>
        </section>
      )}

      {event.post_event_info && (
        <section className={styles.card}>
          <div className={styles.grow}>
            <h2 className={styles.cardTitle}>Recap</h2>
            <MarkdownContent>{event.post_event_info}</MarkdownContent>
          </div>
        </section>
      )}

      <section className={styles.card}>
        <span className={styles.icon}><Images size={18} strokeWidth={1.75} aria-hidden="true" /></span>
        <div className={styles.grow}>
          <h2 className={styles.cardTitle}>Photos</h2>
          {albums.length === 0 ? (
            <p className={styles.text}>Photos aren&apos;t up yet — check back soon.</p>
          ) : (
            <div className={styles.albums}>
              {albums.map((a, i) => (
                <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" className={styles.album}>
                  {a.title || 'Photo Album'} <ExternalLink size={12} strokeWidth={1.75} aria-hidden="true" />
                </a>
              ))}
            </div>
          )}
        </div>
      </section>

      {ticket && (
        <section className={styles.card}>
          <div className={styles.grow}>
            <h2 className={styles.cardTitle}>How was it?</h2>
            <FeedbackForm eventId={eventId} userId={profile.id} initialRating={feedback?.rating ?? null} initialComment={feedback?.comment ?? ''} />
          </div>
        </section>
      )}

      {(upcoming ?? []).length > 0 && (
        <section className={styles.card}>
          <span className={styles.icon}><CalendarDays size={18} strokeWidth={1.75} aria-hidden="true" /></span>
          <div className={styles.grow}>
            <h2 className={styles.cardTitle}>Up next</h2>
            <ul className={styles.next}>
              {(upcoming ?? []).map((e) => (
                <li key={e.id}>
                  <Link href={`/events/${e.slug ?? e.id}`} className={styles.link}>{e.title}</Link>
                  <span className={styles.text}> · {new Date(e.start_date).toLocaleDateString('en-US', { timeZone: PACIFIC_TZ, month: 'short', day: 'numeric' })}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}

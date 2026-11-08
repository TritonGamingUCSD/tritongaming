import Link from 'next/link';
import { CalendarDays, MapPin, Ticket } from 'lucide-react';
import { getProfile, getUserRoles } from '@/lib/core/auth';
import { createClient } from '@/lib/supabase/server';
import { isVerifiedMember } from '@/lib/portal/capabilities';
import { openEventsFilter } from '@/lib/events/checkinWindow';
import { formatEventDateRange, formatEventTimeRange } from '@/lib/core/timezone';
import QuickRegister from './QuickRegister';
import styles from './events.module.css';

export const dynamic = 'force-dynamic';

// One place for events when you are signed in: the tickets you hold for what is coming up, then everything open for sign-up with a Register button on each. Past tickets and the history stay in My Tickets.
export default async function MyEventsPage() {
  const profile = await getProfile();
  if (!profile) return null;
  const roles = await getUserRoles();
  const student = isVerifiedMember(roles);
  const supabase = await createClient();
  const [{ data: mine }, { data: open }] = await Promise.all([
    supabase
      .from('tickets')
      .select('id, status, event:events(id, slug, title, start_date, end_date, location)')
      .eq('user_id', profile.id)
      .in('status', ['active', 'used'])
      .order('created_at', { ascending: false })
      .limit(60),
    supabase
      .from('events')
      .select('id, slug, title, start_date, end_date, location, audience, ticket_price, points_value')
      .eq('is_published', true)
      .or(openEventsFilter())
      .order('start_date', { ascending: true })
      .limit(40),
  ]);
  type Ev = { id: string; slug: string | null; title: string; start_date: string; end_date: string | null; location: string | null };
  const now = Date.now();
  const ticketed = new Map<string, string>();
  const upcoming = (mine ?? [])
    .map((t) => ({ id: t.id as string, event: t.event as unknown as Ev | null }))
    .filter((t): t is { id: string; event: Ev } => !!t.event)
    .filter((t) => Date.parse(t.event.end_date ?? t.event.start_date) + 12 * 3600e3 >= now)
    .sort((a, b) => Date.parse(a.event.start_date) - Date.parse(b.event.start_date));
  for (const t of upcoming) ticketed.set(t.event.id, t.id);
  const joinable = (open ?? []).filter((e) => !ticketed.has(e.id as string) && (e.audience !== 'ucsd_only' || student));
  const when = (e: Ev) => `${formatEventDateRange(e.start_date, e.end_date, { weekday: true })} · ${formatEventTimeRange(e.start_date, e.end_date)}`;

  return (
    <div className={styles.page}>
      <section aria-labelledby="mine-h">
        <h2 id="mine-h" className={styles.h}>
          Your Tickets
        </h2>
        {upcoming.length === 0 ? (
          <p className={styles.empty}>No tickets for what’s coming up. Pick something below.</p>
        ) : (
          <ul className={styles.list}>
            {upcoming.map((t) => (
              <li key={t.id} className={`${styles.card} ${styles.mine}`}>
                <div className={styles.text}>
                  <b>{t.event.title}</b>
                  <span>
                    <CalendarDays size={14} aria-hidden="true" /> {when(t.event)}
                  </span>
                  {t.event.location && (
                    <span>
                      <MapPin size={14} aria-hidden="true" /> {t.event.location}
                    </span>
                  )}
                </div>
                <Link href={`/me/tickets?qr=${t.id}`} className={styles.show}>
                  <Ticket size={15} aria-hidden="true" /> Show Ticket
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="open-h">
        <h2 id="open-h" className={styles.h}>
          Open For Sign-Up
        </h2>
        {joinable.length === 0 ? (
          <p className={styles.empty}>Nothing else is open right now. Check the calendar for what’s planned.</p>
        ) : (
          <ul className={styles.list}>
            {joinable.map((e) => (
              <li key={e.id as string} className={styles.card}>
                <div className={styles.text}>
                  <Link href={`/events/${e.slug || e.id}`}>
                    <b>{e.title as string}</b>
                  </Link>
                  <span>
                    <CalendarDays size={14} aria-hidden="true" /> {when(e as Ev)}
                  </span>
                  {e.location && (
                    <span>
                      <MapPin size={14} aria-hidden="true" /> {e.location as string}
                    </span>
                  )}
                  <small>
                    {student ? 'Free for you' : Number(e.ticket_price) > 0 ? `$${e.ticket_price}` : 'Free'}
                    {student && Number(e.points_value) > 0 ? ` · +${e.points_value} points on check-in` : ''}
                  </small>
                </div>
                <QuickRegister eventId={e.id as string} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className={styles.more}>
        <Link href="/me/calendar">See the calendar</Link> · <Link href="/me/tickets">Past tickets and history</Link> · <Link href="/events">Public events page</Link>
      </p>
    </div>
  );
}

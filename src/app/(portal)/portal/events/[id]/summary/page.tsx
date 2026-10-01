import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { Users, Sparkles, Award, Clock } from 'lucide-react';
import { getUserRoles } from '@/lib/auth';
import { hasCapability } from '@/lib/capabilities';
import { createClient } from '@/lib/supabase/server';
import { PACIFIC_TZ } from '@/lib/timezone';
import { getEventSummary } from '@/lib/eventSummary';
import { Gauge, Donut, Columns, RankBars, Funnel, SplitBar, PALETTE } from './SummaryCharts';
import PrintButton from './PrintButton';
import styles from './summary.module.css';

export const metadata = { title: 'Event Summary' };
export const dynamic = 'force-dynamic';

function Card({ title, note, wide, children }: { title: string; note?: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <section className={`${styles.card} ${wide ? styles.wide : ''}`}>
      <div>
        <h2 className={styles.cardTitle}>{title}</h2>
        {note && <p className={styles.note}>{note}</p>}
      </div>
      {children}
    </section>
  );
}

export default async function EventSummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const roles = await getUserRoles();
  if (!hasCapability(roles, 'checkin')) redirect('/portal');

  const supabase = await createClient();
  const { data: event } = await supabase.from('events').select('id, title, start_date, location, requires_checkin_form').eq('id', id).maybeSingle();
  if (!event) notFound();

  const s = await getEventSummary(id, event);
  const funnel = [
    { label: 'Registered', value: s.registered },
    { label: 'Checked in', value: s.checkedIn },
    ...(s.formOpened !== null ? [{ label: 'Opened AS Form', value: s.formOpened }] : []),
  ];
  const tiles = [
    { icon: <Users size={16} strokeWidth={1.75} aria-hidden="true" />, value: s.checkedIn, label: 'Attendees' },
    { icon: <Sparkles size={16} strokeWidth={1.75} aria-hidden="true" />, value: s.firstTime, label: 'First-timers' },
    { icon: <Award size={16} strokeWidth={1.75} aria-hidden="true" />, value: s.pointsAwarded.toLocaleString(), label: 'Points awarded' },
    { icon: <Clock size={16} strokeWidth={1.75} aria-hidden="true" />, value: s.noShows, label: 'No-shows' },
  ];
  const peak = [...s.arrivals].sort((a, b) => b.count - a.count)[0];

  return (
    <div className={styles.page}>
      <Link href="/portal?section=events" className={styles.back}>← Back to Events</Link>

      <header className={styles.hero}>
        <div className={styles.heroText}>
          <p className={styles.kicker}>Event summary</p>
          <h1 className={styles.title}>{event.title}</h1>
          <p className={styles.sub}>
            {new Date(event.start_date).toLocaleDateString('en-US', { timeZone: PACIFIC_TZ, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            {event.location && ` · ${event.location}`}
          </p>
          <div className={styles.tiles}>
            {tiles.map((t) => (
              <div key={t.label} className={styles.tile}>
                <span className={styles.tileIcon}>{t.icon}</span>
                <span className={styles.tileValue}>{t.value}</span>
                <span className={styles.tileLabel}>{t.label}</span>
              </div>
            ))}
          </div>
        </div>
        <Gauge value={s.attendanceRate} label="showed up" />
      </header>

      <div className={`${styles.actions} ${styles.noPrint}`}>
        <PrintButton />
      </div>

      <p className={styles.note}>Breakdowns cover the {s.checkedIn} checked-in attendee{s.checkedIn === 1 ? '' : 's'}. Aggregates only — nobody&apos;s individual answers are shown here.</p>

      <div className={styles.grid}>
        <Card title="Attendance funnel" note={s.cancelled ? `${s.cancelled} cancelled ticket${s.cancelled === 1 ? '' : 's'} not counted.` : undefined}>
          <Funnel steps={funnel} />
        </Card>
        <Card title="New vs. returning" note="Returning = checked in to an earlier event.">
          <SplitBar a={{ label: 'First-timers', value: s.firstTime, color: PALETTE[0] }} b={{ label: 'Returning', value: s.returning, color: PALETTE[1] }} />
        </Card>
        <Card title="Arrival time" note={peak ? `Busiest half hour: ${peak.label} (${peak.count}). Times are Pacific.` : 'Check-ins per half hour (Pacific).'} wide>
          <Columns data={s.arrivals} color="#4a90e2" />
        </Card>
        <Card title="Gender"><Donut data={s.gender} /></Card>
        <Card title="Class year"><Donut data={s.year} /></Card>
        <Card title="Field of study" note="Majors grouped into broad areas (a double major counts under the first one listed).">
          <Donut data={s.field} />
        </Card>
        <Card title="Top majors" note={`% of attendees. Abbreviations and typos are merged ("CS", "comp sci" → Computer Science). Double majors count toward each major${s.doubleMajors ? ` — ${s.doubleMajors} attendee${s.doubleMajors === 1 ? ' is' : 's are'} double majoring` : ''}.`}>
          <RankBars data={s.major} color="#ffc72c" base={s.checkedIn} />
        </Card>
        <Card title="Colleges"><Donut data={s.college} /></Card>
        <Card title="Pronouns"><Donut data={s.pronouns} /></Card>
        <Card title="Platforms" note="% of attendees — they can pick several."><RankBars data={s.platforms} color="#a78bfa" base={s.checkedIn} /></Card>
        <Card title="Division interest" note="% of attendees — they can pick several."><RankBars data={s.divisions} color="#f472b6" base={s.checkedIn} /></Card>
        <Card title="Attendee feedback" wide>
          {s.feedback.count === 0 ? (
            <p className={styles.note}>No feedback yet — attendees can leave a rating from their ticket after the event.</p>
          ) : (
            <>
              <div className={styles.rating}><span className={styles.ratingValue}>{s.feedback.average}</span><span className={styles.ratingOf}>/ 5 from {s.feedback.count} response{s.feedback.count === 1 ? '' : 's'}</span></div>
              {s.feedback.comments.length > 0 && <ul className={styles.comments}>{s.feedback.comments.map((c, i) => <li key={i}>{c}</li>)}</ul>}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { Users, Sparkles, Award, Clock } from 'lucide-react';
import { getUserRoles } from '@/lib/core/auth';
import { hasCapability } from '@/lib/portal/capabilities';
import { createClient } from '@/lib/supabase/server';
import { formatEventDateRange, eventDayCount } from '@/lib/core/timezone';
import { getEventSummary } from '@/lib/events/eventSummary';
import { Gauge, Donut, Columns, RankBars, Funnel, SplitBar, PALETTE } from './SummaryCharts';
import PrintButton from './PrintButton';
import SectionHeader from '@/components/ui/SectionHeader';
import Notice from '@/components/ui/Notice';
import styles from './summary.module.css';

export const metadata = { title: 'Event Summary' };
export const dynamic = 'force-dynamic';

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={styles.group}>
      <h2 className={styles.groupTitle}>{title}</h2>
      <div className={styles.grid}>{children}</div>
    </section>
  );
}

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
  const { data: event } = await supabase.from('events').select('id, title, start_date, end_date, location, requires_checkin_form').eq('id', id).maybeSingle();
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
    ...(s.allDays !== null ? [{ icon: <Users size={16} strokeWidth={1.75} aria-hidden="true" />, value: s.allDays, label: 'Came every day' }] : []),
  ];
  const multiDay = eventDayCount(event.start_date, event.end_date) > 1;
  const peak = [...s.arrivals].sort((a, b) => b.count - a.count)[0];

  return (
    <div className={styles.page}>
      <Link href="/portal/events" className={styles.back}>← Back to Events</Link>
      <SectionHeader title={event.title} sub={<>{formatEventDateRange(event.start_date, event.end_date, { weekday: true })}{event.location && ` · ${event.location}`}</>}
        actions={<span className={styles.noPrint}><PrintButton /></span>} />

      <div className={styles.stats}>
        <div className={styles.gaugeTile}><Gauge value={s.attendanceRate} label="showed up" /></div>
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

      {s.checkedIn === 0
        ? <Notice tone="info">Nobody has checked in yet, so the breakdowns below are empty. They fill in as people check in.</Notice>
        : <p className={styles.note}>Breakdowns cover the {s.checkedIn} checked-in attendee{s.checkedIn === 1 ? '' : 's'}. Aggregates only; nobody&apos;s individual answers are shown here.</p>}

      <Group title="Attendance">
        <Card title="Attendance funnel" note={s.cancelled ? `${s.cancelled} cancelled ticket${s.cancelled === 1 ? '' : 's'} not counted.` : undefined}>
          <Funnel steps={funnel} />
        </Card>
        <Card title="New vs. returning" note="Returning = checked in to an earlier event.">
          <SplitBar a={{ label: 'First-timers', value: s.firstTime, color: PALETTE[0] }} b={{ label: 'Returning', value: s.returning, color: PALETTE[1] }} />
        </Card>
        <Card title="Arrival time" note={peak ? `Busiest ${multiDay ? 'day' : 'half hour'}: ${peak.label} (${peak.count}). Times are Pacific.` : `Check-ins per ${multiDay ? 'day' : 'half hour'} (Pacific).`} wide>
          <Columns data={s.arrivals} color="#4a90e2" />
        </Card>
        <Card title="When tickets were claimed" note="How far ahead of the event people got their ticket (all registrations)." wide>
          <Columns data={s.claimTiming} color="#34d399" />
        </Card>
        <Card title="Where they came from" note="How each person found the event, recorded when they claimed a ticket. Tickets claimed before this tracking existed show as “Not tracked”.">
          <RankBars data={s.sources} color="#4a90e2" base={s.registered} />
        </Card>
      </Group>
      {s.checkedIn > 0 && <>
      <Group title="Who came">
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
      </Group>
      <Group title="What they play and want">
        <Card title="Platforms" note="% of attendees — they can pick several."><RankBars data={s.platforms} color="#a78bfa" base={s.checkedIn} /></Card>
        <Card title="Favorite games" note="% of attendees. Common short names are merged (Smash, SSBU → Super Smash Bros.). They can list several."><RankBars data={s.games} color="#34d399" base={s.checkedIn} /></Card>
        <Card title="Division interest" note="% of attendees — they can pick several."><RankBars data={s.divisions} color="#f472b6" base={s.checkedIn} /></Card>
      </Group>
      </>}
      <Group title="Feedback">
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
      </Group>
    </div>
  );
}

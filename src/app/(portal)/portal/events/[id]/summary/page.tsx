import { redirect, notFound } from 'next/navigation';
import Image from 'next/image';
import Link from '@/components/portal/NoPrefetchLink';
import { getUserRoles } from '@/lib/core/auth';
import { hasCapability } from '@/lib/portal/capabilities';
import { createClient } from '@/lib/supabase/server';
import { formatEventDateRange, eventDayCount, PACIFIC_TZ } from '@/lib/core/timezone';
import { getEventSummary } from '@/lib/events/eventSummary';
import { Gauge, Donut, BarChart, RankBars, Funnel, SplitBar, PALETTE } from './SummaryCharts';
import { PreparedFor, SocialReach, SponsorThanks } from './ReportContext';
import ReportShell from './ReportShell';
import type { ReportData, ReportPhoto } from './reportTypes';
import type { EventSponsor, ReportMetric } from '@/types/database';
import type { PageBlock } from '@/lib/site/pageBlocks';
import { cleanTheme } from '@/lib/events/eventTheme';
import Notice from '@/components/ui/Notice';
import styles from './summary.module.css';

export const metadata = { title: 'Event Report' };
export const dynamic = 'force-dynamic';

function Section({ n, title, lead, children }: { n: string; title: string; lead?: string; children: React.ReactNode }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}><span className={styles.sectionNum}>{n}</span>{title}</h2>
      {lead && <p className={styles.lead}>{lead}</p>}
      <div className={styles.grid}>{children}</div>
    </section>
  );
}

function Card({ title, note, wide, children }: { title: string; note?: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={`${styles.card} ${wide ? styles.wide : ''}`}>
      <h3 className={styles.cardTitle}>{title}</h3>
      {note && <p className={styles.note}>{note}</p>}
      {children}
    </div>
  );
}

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

export default async function EventSummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const roles = await getUserRoles();
  if (!hasCapability(roles, 'checkin')) redirect('/portal');

  const supabase = await createClient();
  const { data: event } = await supabase.from('events').select('id, title, start_date, end_date, location, requires_checkin_form, ticket_price, audience, sponsors, page_blocks, report_social, flyer_url, theme').eq('id', id).maybeSingle();
  if (!event) notFound();

  const s = await getEventSummary(id, event);
  const multiDay = eventDayCount(event.start_date, event.end_date) > 1;
  const peak = [...s.arrivals].sort((a, b) => b.count - a.count).find((b) => b.count > 0);
  const returningRate = s.checkedIn ? Math.round((s.returning / s.checkedIn) * 100) : 0;
  const firstRate = s.checkedIn ? Math.round((s.firstTime / s.checkedIn) * 100) : 0;
  const prepared = new Date().toLocaleDateString('en-US', { timeZone: PACIFIC_TZ, month: 'long', day: 'numeric', year: 'numeric' });
  const funnel = [
    { label: 'Registered', value: s.registered },
    { label: 'Attended', value: s.checkedIn },
  ];
  const kpis = [
    { value: s.checkedIn.toLocaleString(), label: 'Attendees' },
    { value: `${s.attendanceRate}%`, label: 'Of registrations attended' },
    { value: s.registered.toLocaleString(), label: 'Registrations' },
    { value: `${firstRate}%`, label: 'First-time attendees' },
    ...(s.feedback.average !== null ? [{ value: `${s.feedback.average} / 5`, label: `Average rating (${s.feedback.count})` }] : []),
    ...(s.allDays !== null ? [{ value: s.allDays.toLocaleString(), label: 'Attended every day' }] : []),
  ];
  const summary = s.checkedIn === 0
    ? 'Attendance figures will appear here once people have checked in.'
    : `${plural(s.checkedIn, 'attendee')} took part${s.registered ? `, ${s.attendanceRate}% of the ${s.registered.toLocaleString()} people who registered` : ''}. ${firstRate}% were attending a Triton Gaming event for the first time and ${returningRate}% had been to an earlier one.${peak ? ` Arrivals were busiest ${multiDay ? 'on' : 'around'} ${peak.label}.` : ''}${s.feedback.average !== null ? ` Attendees who left feedback rated the event ${s.feedback.average} out of 5.` : ''}`;
  const hasAudience = s.checkedIn > 0;
  // The event's own artwork: its main poster and the stickers from its design guide.
  const theme = cleanTheme(event.theme);
  const poster = theme?.posters?.[0] ?? event.flyer_url ?? null;
  const stickers = (theme?.stickers ?? []).slice(0, 6);
  // The few facts worth putting in words: only when the numbers clearly support them, so a small or even crowd never gets a forced sentence.
  const top = (b: { label: string; count: number }[], skip = ['Other', 'Not provided', 'Undeclared']) => b.find((x) => !skip.includes(x.label)) ?? null;
  const pctOf = (n: number) => Math.round((n / Math.max(1, s.checkedIn)) * 100);
  const highlights: { label: string; text: string }[] = [];
  if (s.checkedIn >= 10) {
    const yr = top(s.year); const col = top(s.college);
    const aud = [yr && pctOf(yr.count) >= 25 ? `${pctOf(yr.count)}% were ${yr.label.toLowerCase()} students` : null, col && pctOf(col.count) >= 15 ? `${pctOf(col.count)}% were from ${col.label}${/college$/i.test(col.label) ? '' : ' College'}` : null].filter(Boolean);
    if (aud.length) highlights.push({ label: 'Audience', text: `${aud.join(' and ')}.` });
    const fld = top(s.field); const maj = top(s.major);
    if (fld && pctOf(fld.count) >= 20) highlights.push({ label: 'Studies', text: `${pctOf(fld.count)}% study ${fld.label}${maj && pctOf(maj.count) >= 8 ? `; ${maj.label} is the most common major (${pctOf(maj.count)}%)` : ''}.` });
    const plat = top(s.platforms); const game = top(s.games);
    if (plat && pctOf(plat.count) >= 15) highlights.push({ label: 'Interests', text: `${plat.label} is the most common platform (${pctOf(plat.count)}%)${game && pctOf(game.count) >= 10 ? ` and ${game.label} the most-named favorite game (${pctOf(game.count)}%)` : ''}.` });
    const repeatPeople = s.repeat.slice(1).reduce((n, b) => n + b.count, 0);
    if (repeatPeople > 0) highlights.push({ label: 'Community', text: `${pctOf(repeatPeople)}% had been to an earlier Triton Gaming event; ${pctOf(s.firstTime)}% were new.` });
  }
  let secNum = 0;
  const next = () => String(++secNum).padStart(2, '0');
  // Photos for the report come from the gallery on the event's own page.
  const photos: ReportPhoto[] = ((event.page_blocks ?? []) as PageBlock[]).flatMap((b) => (b.type === 'gallery' ? b.items.filter((i) => i.url).map((i) => ({ url: i.url, caption: i.caption ?? '', credit: i.credit ?? '' })) : [])).slice(0, 6);
  const when = `${formatEventDateRange(event.start_date, event.end_date, { weekday: true })}${event.location ? ` · ${event.location}` : ''}`;
  const report: ReportData = {
    eventId: event.id, title: event.title, when, prepared, summary, multiDay, firstRate, returningRate, s,
    sponsors: ((event.sponsors ?? []) as EventSponsor[]).filter((x) => x.name),
    photos,
    social: (event.report_social ?? []) as ReportMetric[],
    canEditSocial: hasCapability(roles, 'manage_events'),
    highlights, poster, stickers,
    peakNote: peak ? `Busiest ${multiDay ? 'day' : 'hour'}: ${peak.label} (${plural(peak.count, 'check-in')}). Times are Pacific.` : null,
  };

  return (
    <ReportShell report={report} back={<Link href="/portal/events" className={styles.back}>← Back to Events</Link>} internal={
      <aside className={styles.internal} data-print-hide>
        <h2 className={styles.internalTitle}>For the team only (not in the PDF)</h2>
        <dl className={styles.internalList}>
          <div><dt>No-shows</dt><dd>{s.noShows}</dd></div>
          <div><dt>Cancelled tickets</dt><dd>{s.cancelled}</dd></div>
          <div><dt>Points awarded</dt><dd>{s.pointsAwarded.toLocaleString()}</dd></div>
          {s.revenue !== null && <div><dt>Paid tickets</dt><dd>{s.paid}</dd></div>}
          {s.revenue !== null && <div><dt>Ticket revenue</dt><dd>${s.revenue.toLocaleString()}</dd></div>}
          {s.formOpened !== null && <div><dt>Check-in forms not completed</dt><dd>{s.checkedIn - s.formOpened}</dd></div>}
        </dl>
        {s.sources.length > 0 && (
          <>
            <h3 className={styles.internalSub}>Where ticket claims came from</h3>
            <p className={styles.internalNote}>Only counts people who followed a link we tagged. Anyone who scanned a QR code or typed the address shows as Direct, so this understates posters and QR codes; it is not shown in the sponsor report.</p>
            <ul className={styles.internalSources}>{s.sources.map((b) => <li key={b.label}><span>{b.label}</span><b>{b.count}</b></li>)}</ul>
          </>
        )}
      </aside>
    }>
      <header className={styles.masthead}>
        <div className={styles.brand}>
          <Image src="/logos/tg_logo.png" alt="" width={56} height={56} className={styles.logo} />
          <div>
            <p className={styles.brandName}>Triton Gaming</p>
            <p className={styles.brandTag}>Gaming Org at UC San Diego</p>
          </div>
        </div>
        <div className={styles.docMeta}>
          <p className={styles.docType}>Event Impact Report</p>
          <p className={styles.docDate}>Prepared {prepared}</p>
        </div>
      </header>
      <div className={styles.rule} aria-hidden="true" />
      <div className={styles.titleBlock}>
        {poster && (
          <div className={styles.posterWrap} aria-hidden="true">
            {/* The event's own poster: an address from the event page, any host, so next/image cannot be configured for it. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={poster} alt="" className={styles.poster} />
          </div>
        )}
        <h1 className={styles.title}>{event.title}</h1>
        <p className={styles.when}>{formatEventDateRange(event.start_date, event.end_date, { weekday: true })}{event.location && ` · ${event.location}`}</p>
        <PreparedFor />
      </div>

      <section className={styles.summaryBlock}>
        <h2 className={styles.sectionTitle}><span className={styles.sectionNum}>00</span>Summary</h2>
        <div className={styles.summaryRow}>
          <div className={styles.gaugeBox}><Gauge value={s.attendanceRate} label="attended" /></div>
          <div className={styles.summaryText}>
            <p className={styles.summaryPara}>{summary}</p>
            <div className={styles.kpis}>
              {kpis.map((k) => (
                <div key={k.label} className={styles.kpi}>
                  <span className={styles.kpiValue}>{k.value}</span>
                  <span className={styles.kpiLabel}>{k.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {highlights.length > 0 && (
        <section className={styles.findings}>
          <h2 className={styles.sectionTitle}><span className={styles.sectionNum}>★</span>Key findings</h2>
          <ul>{highlights.map((h) => <li key={h.label}><b>{h.label}</b> {h.text}</li>)}</ul>
        </section>
      )}

      {s.checkedIn === 0 && <div data-print-hide><Notice tone="info">Nobody has checked in yet, so most of this report is empty. It fills in as people check in.</Notice></div>}

      <Section n={next()} title="Attendance" lead="How many people registered, how many came, and when they arrived.">
        <Card title="Registration to attendance" note={s.cancelled ? `${plural(s.cancelled, 'cancelled ticket')} not counted.` : undefined}>
          <Funnel steps={funnel} />
        </Card>
        <Card title="New and returning attendees" note="Returning means they checked in to an earlier Triton Gaming event.">
          <SplitBar a={{ label: 'First-time', value: s.firstTime, color: PALETTE[0] }} b={{ label: 'Returning', value: s.returning, color: PALETTE[1] }} />
        </Card>
        <Card title={multiDay ? 'Attendance by day' : 'Arrival times'} note={peak ? `Busiest ${multiDay ? 'day' : 'hour'}: ${peak.label} (${plural(peak.count, 'check-in')}). Times are Pacific.` : `Check-ins per ${multiDay ? 'day' : 'hour'} (Pacific).`} wide>
          <BarChart data={s.arrivals} color="#275a8f" xTitle={multiDay ? 'Day' : 'Time of arrival (Pacific time)'} yTitle="People checked in" />
        </Card>
      </Section>

      {hasAudience && (
        <Section n={next()} title="Audience" lead={`Who attended. Based on the ${plural(s.checkedIn, 'checked-in attendee')} and the profile details they chose to share; shown as totals only.`}>
          <Card title="Class year"><Donut data={s.year} /></Card>
          <Card title="Colleges"><Donut data={s.college} /></Card>
          <Card title="Fields of study" note="Majors grouped into broad areas."><Donut data={s.field} /></Card>
          <Card title="Repeat attendance" note="How many Triton Gaming events each attendee has been to, including this one."><Donut data={s.repeat} /></Card>
          <Card title="Top majors" note="Share of attendees. Double majors count toward each major." wide><RankBars data={s.major} color="#011941" base={s.checkedIn} /></Card>
          {s.members !== null && s.guests !== null && (
            <Card title="Students and guests" note="Guests are attendees without a Triton Gaming or UCSD student account."><SplitBar a={{ label: 'Students and members', value: s.members, color: PALETTE[0] }} b={{ label: 'Guests', value: s.guests, color: PALETTE[1] }} /></Card>
          )}
          <Card title="Gender"><Donut data={s.gender} /></Card>
          <Card title="Pronouns"><Donut data={s.pronouns} /></Card>
        </Section>
      )}

      {hasAudience && (
        <Section n={next()} title="Interests" lead="What attendees play and what they want more of. Attendees can choose several answers, so shares can add up to more than 100%.">
          <Card title="Platforms"><RankBars data={s.platforms} color="#275a8f" base={s.checkedIn} /></Card>
          <Card title="Favorite games" note="Common short names are merged (Smash and SSBU count as Super Smash Bros.)."><RankBars data={s.games} color="#011941" base={s.checkedIn} /></Card>
          <Card title="Divisions they are interested in" wide><RankBars data={s.divisions} color="#b8860b" base={s.checkedIn} /></Card>
        </Section>
      )}

      <Section n={next()} title="Reach" lead="How far ahead of the event people planned to come.">
        
        <Card title="When tickets were claimed" note="How far ahead of the event people registered." wide><BarChart data={s.claimTiming} color="#275a8f" xTitle="How far ahead of the event" yTitle="Tickets claimed" /></Card>
        <SocialReach />
      </Section>

      <Section n={next()} title="Attendee feedback">
        <Card title="Rating" wide>
          {s.feedback.count === 0 ? (
            <p className={styles.note}>No feedback has been left yet. Attendees can rate the event from their ticket afterwards.</p>
          ) : (
            <div className={styles.rating}><span className={styles.ratingValue}>{s.feedback.average}</span><span className={styles.ratingOf}>out of 5, from {plural(s.feedback.count, 'response')}</span></div>
          )}
        </Card>
      </Section>

      {photos.length > 0 && (
        <Section n={next()} title="Event photos">
          <div className={styles.wide}>
            <div className={styles.photos}>
              {photos.slice(0, 6).map((ph, i) => (
                <figure key={i} className={styles.photo}>
                  {/* Addresses typed into the event page, from any host, so next/image cannot be configured for them. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={ph.url} alt={ph.caption || 'Event photo'} />
                  {(ph.caption || ph.credit) && <figcaption>{ph.caption}{ph.caption && ph.credit ? ' · ' : ''}{ph.credit && `Photo: ${ph.credit}`}</figcaption>}
                </figure>
              ))}
            </div>
          </div>
        </Section>
      )}

      <SponsorThanks n={next()} />

      {stickers.length > 0 && (
        <div className={styles.stickerStrip} aria-hidden="true">
          {stickers.map((u, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={u} alt="" style={{ transform: `rotate(${[-6, 5, -3, 7, -5, 4][i % 6]}deg)` }} />
          ))}
        </div>
      )}

      <p className={styles.method}>About these figures: registration and attendance come from Triton Gaming’s ticketing and on-site check-in at tritongaming.org, and have been collected since the 2026-2027 school year (September 2026); earlier events are not included. Audience and interest details (such as gender, pronouns, college, major, platforms and games) are optional in the member portal, so those figures cover only the attendees who chose to share them, and “Not provided” counts those who did not. They are shown as totals; no individual’s answers appear in this report.</p>
      <footer className={styles.printFooter}>Triton Gaming · Gaming Org at UC San Diego · tritongaming.org · {event.title}</footer>

    </ReportShell>
  );
}

import Link from '@/components/portal/PortalLink';
import { CalendarPlus, MapPin, QrCode, Ticket } from 'lucide-react';
import { PACIFIC_TZ } from '@/lib/core/timezone';
import PortalSearch from '@/components/portal/PortalSearch';
import EventCountdown from './EventCountdown';
import RoleAsk from './RoleAsk';
import NowNext from './NowNext';
import { RequiredBanner } from './docs/DocRequired';
import type { MyShift } from '@/lib/shifts/myShifts';
import styles from './dashboardHome.module.css';

export interface HomeEvent { id: string; title: string; start_date: string; location: string | null; hasTicket: boolean; ticketId?: string }
export interface HomeNote { title: string; href: string }
export interface HomeTool { id: string; label: string; hint: string; href: string; tier: 'everyone' | 'officer' }
export interface HomeActivity { key: string; text: string; detail: string; at: string }

const day = (iso: string) => new Date(iso).toLocaleDateString('en-US', { timeZone: PACIFIC_TZ, weekday: 'long', month: 'long', day: 'numeric' });
const time = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { timeZone: PACIFIC_TZ, hour: 'numeric', minute: '2-digit' });
const ago = (iso: string) => {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 60) return `${mins} min ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)} h ago`;
  return new Date(iso).toLocaleDateString('en-US', { timeZone: PACIFIC_TZ, month: 'short', day: 'numeric' });
};

// The top of the dashboard: which quarter it is, a welcome by name, and the big search field (it only ever finds what this person can open).
export function DashboardWelcome({ eyebrow, name }: { eyebrow: string; name: string }) {
  return (
    <header className={styles.welcome}>
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h1 className={styles.hello} data-keep>Welcome back, <span className={styles.name}>{name}</span>.</h1>
      <div className={styles.search}><PortalSearch large placeholder="Search anything: people, events, meetings, docs, pages…" /></div>
    </header>
  );
}

// Below the to-dos: the next event as a paper ticket, the pinned note, the tools for this person's role, and what happened lately.
export function DashboardBody({ event, note, tools, activity, showRoleAsk = false, shifts = [] }: { shifts?: MyShift[]; showRoleAsk?: boolean; event: HomeEvent | null; note: HomeNote | null; tools: HomeTool[]; activity: HomeActivity[] }) {
  const hasOfficer = tools.some((t) => t.tier === 'officer');
  const hasEveryone = tools.some((t) => t.tier === 'everyone');
  return (
    <div className={styles.body}>
      {showRoleAsk && <RoleAsk />}
      <RequiredBanner hrefBase="/portal/docs?id=" />
      <div className={styles.top}>
        {shifts.length > 0 && <NowNext shifts={shifts} />}
        {event && (
          <article className={styles.ticket} aria-label="Next up">
            <span className={styles.tape} aria-hidden="true" />
            <div className={styles.ticketMain}>
              <span className={styles.sticker}>Next up</span>
              <h2 className={styles.eventTitle}>{event.title}</h2>
              <p className={styles.when}>{day(event.start_date)} · {time(event.start_date)}</p>
              <EventCountdown startsAt={event.start_date} />
              {event.location && <p className={styles.where}><MapPin size={14} aria-hidden="true" /> {event.location}</p>}
              <div className={styles.actions}>
                <Link href={event.hasTicket && event.ticketId ? `/portal/tickets?qr=${event.ticketId}` : '/portal/tickets'} className={styles.primary}>{event.hasTicket ? <><QrCode size={16} aria-hidden="true" /> Show my QR</> : <><Ticket size={16} aria-hidden="true" /> Get my ticket</>}</Link>
                <a href={`/api/events/${event.id}/ics`} download className={styles.secondary}><CalendarPlus size={16} aria-hidden="true" /> Add to calendar</a>
              </div>
            </div>
            <div className={styles.stub} aria-hidden="true"><span>Admit one</span></div>
          </article>
        )}
        {note && (
          <aside className={styles.note} aria-label="Pinned">
            <span className={styles.noteTape} aria-hidden="true" />
            <p className={styles.noteKicker}>Pinned</p>
            <p className={styles.noteTitle}>{note.title}</p>
            <Link href={note.href} className={styles.noteLink}>Read the full post →</Link>
          </aside>
        )}
      </div>

      {tools.length > 0 && (
        <section aria-label="Your tools">
          <h2 className={styles.h}>Your tools</h2>
          {hasOfficer && hasEveryone && <p className={styles.legend}>Paper is for every member · Glass is for officers</p>}
          <div className={styles.tools}>
            {tools.map((t) => (
              <Link key={t.id} href={t.href} className={t.tier === 'everyone' ? styles.paper : styles.glass}>
                <span className={styles.toolKicker}>{t.tier === 'everyone' ? 'Everyone' : 'Officers'}</span>
                <b>{t.label}</b>
                <span>{t.hint}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {activity.length > 0 && (
        <section aria-label="Recent activity" className={styles.activity}>
          <h2 className={styles.h}>Recent activity</h2>
          <ul>
            {activity.map((a) => (
              <li key={a.key}><span className={styles.diamond} aria-hidden="true" /><span><b>{a.text}</b> {a.detail}</span><time dateTime={a.at}>{ago(a.at)}</time></li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

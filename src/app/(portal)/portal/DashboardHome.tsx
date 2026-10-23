import Link from '@/components/portal/PortalLink';
import TGcodeIcon from '@/components/TGcode/TGcodeIcon';
import { CalendarDays, ExternalLink, MapPin, Ticket } from 'lucide-react';
import { PACIFIC_TZ } from '@/lib/core/timezone';
import PortalSearch from '@/components/portal/PortalSearch';
import EventCountdown from './EventCountdown';
import RoleAsk from './RoleAsk';
import LogisticsDayCard from './LogisticsDayCard';
import { RequiredBanner } from './docs/DocRequired';
import styles from './dashboardHome.module.css';

export interface HomeEvent { id: string; title: string; start_date: string; location: string | null; hasTicket: boolean; ticketId?: string }
export interface HomeNote { title: string; href: string }
export interface HomeLink { id: string; title: string; url: string; note: string }
export interface HomeUpcoming { id: string; title: string; start_date: string; location: string | null; hasTicket: boolean; ticketId?: string }

const day = (iso: string) => new Date(iso).toLocaleDateString('en-US', { timeZone: PACIFIC_TZ, weekday: 'long', month: 'long', day: 'numeric' });
const time = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { timeZone: PACIFIC_TZ, hour: 'numeric', minute: '2-digit' });

// The top of the dashboard: which quarter it is, a welcome by name, and the big search field (it only ever finds what this person can open).
export function DashboardWelcome({ eyebrow, name, showSearch = true }: { eyebrow: string; name: string; showSearch?: boolean }) {
  return (
    <header className={styles.welcome}>
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h1 className={styles.hello} data-keep>Welcome back, <span className={styles.name}>{name}</span>.</h1>
      {showSearch && <div className={styles.search}><PortalSearch large placeholder="Search anything: people, events, meetings, docs, pages…" /></div>}
    </header>
  );
}

const shortDay = (iso: string) => new Date(iso).toLocaleDateString('en-US', { timeZone: PACIFIC_TZ, weekday: 'short', month: 'short', day: 'numeric' });

// Below the to-dos: the next event as a paper ticket, the pinned note, the club's quick links, and what is coming up. (The pages themselves are
// in the side bar and the bottom bar, so there is no list of tools here.)
export function DashboardBody({ event, note, links, upcoming, showRoleAsk = false, compact = false, logistics = null }: { logistics?: { admin: boolean } | null; showRoleAsk?: boolean; /** Guests and students on a desktop: the role request sits under the ticket. */ compact?: boolean; event: HomeEvent | null; note: HomeNote | null; links: HomeLink[]; upcoming: HomeUpcoming[] }) {
  return (
    <div className={styles.body}>
      {showRoleAsk && !compact && <RoleAsk />}
      <RequiredBanner hrefBase="/portal/docs?id=" />
      {logistics && <LogisticsDayCard admin={logistics.admin} />}
      <div className={styles.top}>
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
                <Link href={event.hasTicket && event.ticketId ? `/portal/tickets?qr=${event.ticketId}` : '/portal/tickets'} className={styles.primary}>{event.hasTicket ? <><TGcodeIcon size={16} /> Show My TGcode</> : <><Ticket size={16} aria-hidden="true" /> Get my ticket</>}</Link>
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

      {showRoleAsk && compact && <RoleAsk />}

      {(links.length > 0 || upcoming.length > 0) && (
        <div className={styles.cols}>
        {links.length > 0 && (
          <section aria-label="Quick links">
            <h2 className={styles.h}>Quick links</h2>
            <ul className={styles.quick}>
              {links.map((l) => (
                <li key={l.id}>
                  <a className={styles.quickLink} href={l.url} title={l.note || undefined} target="_blank" rel="noopener noreferrer">
                    <strong>{l.title}</strong>
                    <ExternalLink size={13} className={styles.quickOpen} aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
          {upcoming.length > 0 && (
            <section aria-label="Coming up">
              <h2 className={styles.h}>Coming up</h2>
              <ul className={styles.list}>
                {upcoming.map((e) => (
                  <li key={e.id}>
                    <Link href={e.hasTicket && e.ticketId ? `/portal/tickets?qr=${e.ticketId}` : '/portal/tickets'} className={styles.upRow}>
                      <CalendarDays size={16} aria-hidden="true" />
                      <span className={styles.upText}><strong>{e.title}</strong><small>{shortDay(e.start_date)} · {time(e.start_date)}{e.location ? ` · ${e.location}` : ''}</small></span>
                      <span className={e.hasTicket ? styles.upHave : styles.upGet}>{e.hasTicket ? 'Have ticket' : 'Get ticket'}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

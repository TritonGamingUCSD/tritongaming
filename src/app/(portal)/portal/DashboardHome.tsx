import Link from '@/components/portal/PortalLink';
import TGcodeIcon from '@/components/TGcode/TGcodeIcon';
import { ExternalLink, MapPin, Ticket } from 'lucide-react';
import { PACIFIC_TZ, formatPacificTime } from '@/lib/core/timezone';
import PortalSearch from '@/components/portal/PortalSearch';
import EventCountdown from './EventCountdown';
import type { HomeActivity, HomeAttention } from '@/lib/portal/homeExtras';
import RoleAsk from './RoleAsk';
import LogisticsDayCard from './LogisticsDayCard';
import { RequiredBanner } from './docs/DocRequired';
import styles from './dashboardHome.module.css';

export interface HomeEvent { id: string; title: string; start_date: string; location: string | null; hasTicket: boolean; ticketId?: string }
export interface HomeNote { title: string; href: string }
export interface HomeStat { label: string; value: string; sub: string; href: string; progress?: number }
export interface HomeLink { id: string; title: string; url: string; note: string }

const day = (iso: string) => new Date(iso).toLocaleDateString('en-US', { timeZone: PACIFIC_TZ, weekday: 'long', month: 'long', day: 'numeric' });
const ago = (iso: string) => { const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000)); return m < 1 ? 'now' : m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`; };
const time = (iso: string) => formatPacificTime(iso);

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


// Below the to-dos: the next event as a paper ticket, the pinned note, the club's quick links, and what is coming up. (The pages themselves are
// in the side bar and the bottom bar, so there is no list of tools here.)
export function DashboardBody({ event, note, links, stats = [], attention = [], activity = [], showRoleAsk = false, compact = false, logistics = false }: { logistics?: boolean; showRoleAsk?: boolean; /** Guests and students on a desktop: the role request sits under the ticket. */ compact?: boolean; event: HomeEvent | null; note: HomeNote | null; links: HomeLink[]; stats?: HomeStat[]; attention?: HomeAttention[]; activity?: HomeActivity[] }) {
  return (
    <div className={styles.body}>
      {showRoleAsk && !compact && <RoleAsk />}
      <RequiredBanner hrefBase="/portal/docs?id=" />
      {logistics && <LogisticsDayCard />}
      <div className={styles.deskGrid}>
      <div className={styles.deskMain}>
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
        {showRoleAsk && compact && <RoleAsk />}
        {attention.length > 0 && (
          <section className={`${styles.panel} ${styles.deskOnly}`} aria-label="Needs your attention">
            <h2 className={styles.panelTitle}>Needs your attention <span className={styles.panelCount}>{attention.length}</span></h2>
            <ul className={styles.panelList}>
              {attention.map((a) => (
                <li key={a.id}>
                  <Link href={a.href ?? '/portal'} className={styles.panelRow}>
                    <span className={styles.panelText}><strong>{a.title}</strong>{a.body && <small>{a.body}</small>}</span>
                    <span className={styles.panelWhen}>{ago(a.at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        {activity.length > 0 && (
          <section className={`${styles.panel} ${styles.deskOnly}`} aria-label="Recent activity">
            <h2 className={styles.panelTitle}>Recent activity</h2>
            <ul className={styles.panelList}>
              {activity.map((a) => (
                <li key={a.id}>
                  <Link href={a.href} className={styles.panelRow}>
                    <span className={styles.panelKind}>{a.kind}</span>
                    <span className={styles.panelText}><strong>{a.title}</strong></span>
                    <span className={styles.panelWhen}>{ago(a.at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
      <div className={styles.deskSide}>
        {stats.length > 0 && (
          <section className={`${styles.panel} ${styles.deskOnly}`} aria-label="My numbers">
            <h2 className={styles.panelTitle}>My numbers</h2>
            <div className={styles.statGrid}>
              {stats.map((x) => (
                <Link key={x.label} href={x.href} className={styles.stat}>
                  <span className={styles.statLabel}>{x.label}</span>
                  <b className={styles.statValue}>{x.value}</b>
                  <small className={styles.statSub}>{x.sub}</small>
                  {x.progress !== undefined && <span className={styles.statBar}><span style={{ width: `${x.progress}%` }} /></span>}
                </Link>
              ))}
            </div>
          </section>
        )}
        {note && (
          <aside className={styles.note} aria-label="Pinned">
            <span className={styles.noteTape} aria-hidden="true" />
            <p className={styles.noteKicker}>Pinned</p>
            <p className={styles.noteTitle}>{note.title}</p>
            <Link href={note.href} className={styles.noteLink}>Read the full post →</Link>
          </aside>
        )}

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
        </div>
      </div>
      </div>
    </div>
  );
}

import Image from 'next/image';
import Link from '@/components/portal/PortalLink';
import CodeIcon from '@/components/portal/CodeIcon';
import CodeName from '@/components/portal/CodeName';
import { ExternalLink, MapPin, Ticket } from 'lucide-react';
import { PACIFIC_TZ, formatPacificTime } from '@/lib/core/timezone';
import PortalSearch from '@/components/portal/PortalSearch';
import DashboardCode from './DashboardCode';
import EventCountdown from './EventCountdown';
import type { HomeActivity, HomeAttention, HomeShoutout } from '@/lib/portal/homeExtras';
import RoleAsk from './RoleAsk';
import ShoutoutCard from './ShoutoutCard';
import LogisticsDayCard from './LogisticsDayCard';
import TodayCards from './TodayCards';
import HomeCards, { type HomeCard } from './HomeCards';
import NextEventHero from './NextEventHero';
import TermProgress from './TermProgress';
import MemberPass, { type PassData } from './MemberPass';
import type { TermInfoData } from '@/lib/members/termInfo';
import heroStyles from './homeHero.module.css';
import { RequiredBanner } from './docs/DocRequired';
import styles from './dashboardHome.module.css';

export interface HomeEvent {
  flyer?: string | null;
  id: string;
  title: string;
  start_date: string;
  location: string | null;
  hasTicket: boolean;
  ticketId?: string;
}
export interface HomeNote {
  title: string;
  href: string;
}
export interface HomeStat {
  label: string;
  value: string;
  sub: string;
  href: string;
  progress?: number;
}
export interface HomeLink {
  id: string;
  title: string;
  url: string;
  note: string;
}

const day = (iso: string) => new Date(iso).toLocaleDateString('en-US', { timeZone: PACIFIC_TZ, weekday: 'long', month: 'long', day: 'numeric' });
const ago = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return m < 1 ? 'now' : m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`;
};
const time = (iso: string) => formatPacificTime(iso);

// The top of the dashboard: which quarter it is, a welcome by name, and the big search field (it only ever finds what this person can open).
export function DashboardWelcome({ eyebrow, name, showSearch = true }: { eyebrow: string; name: string; showSearch?: boolean }) {
  return (
    <header className={styles.welcome}>
      <p className={styles.sticker}>{eyebrow}</p>
      <h1 className={styles.hello} data-keep>
        Welcome back,<span className={styles.name}>{name}</span>
      </h1>
      {showSearch && (
        <div className={styles.search}>
          <PortalSearch large placeholder="Search anything: people, events, meetings, docs, pages…" />
        </div>
      )}
    </header>
  );
}

// Below the to-dos: the next event as a paper ticket, the pinned note, the club's quick links, and what is coming up. (The pages themselves are
// in the side bar and the bottom bar, so there is no list of tools here.)
export function DashboardBody({
  event,
  note,
  links,
  stats = [],
  attention = [],
  activity = [],
  showRoleAsk = false,
  compact = false,
  logistics = false,
  cards = [],
  term = null,
  pins = [],
  myDivisions = [],
  shoutout = null,
  canShout = false,
  pass = null,
  explore = [],
}: {
  pins?: { id: string; label: string }[];
  /** The divisions this person belongs to (not just the ones an admin can see): a card each, to jump into. */
  myDivisions?: { slug: string; name: string; logoUrl: string | null; accent: string; level: string }[];
  shoutout?: HomeShoutout | null;
  canShout?: boolean;
  /** Someone not on the team: their member pass (a student) or welcome ticket (a guest) opens the page. */
  pass?: PassData | null;
  /** Divisions to explore (when division pages are open to everyone): a card each, opening its public page. */
  explore?: { slug: string; name: string; logoUrl: string | null; accent: string }[];
  term?: TermInfoData | null;
  cards?: HomeCard[];
  logistics?: boolean;
  showRoleAsk?: boolean;
  /** Guests and students on a desktop: the role request sits under the ticket. */ compact?: boolean;
  event: HomeEvent | null;
  note: HomeNote | null;
  links: HomeLink[];
  stats?: HomeStat[];
  attention?: HomeAttention[];
  activity?: HomeActivity[];
}) {
  return (
    <div className={styles.body}>
      {/* On a phone the order is what to act on first: a request or a required doc, what is on today, the next event, the code to show, this person's cards and divisions, then the note and links; the club shoutout comes last
          and the term bar and pins (the bottom bar has those) are left out. On a laptop the order below is the order on screen. */}
      {pass && (
        <div className={styles.m0}>
          <MemberPass pass={pass} />
        </div>
      )}
      {showRoleAsk && !compact && (
        <div className={styles.m0}>
          <RoleAsk />
        </div>
      )}
      <div className={styles.m9}>
        <ShoutoutCard shoutout={shoutout} canPost={canShout} />
      </div>
      <div className={styles.m1}>
        <RequiredBanner hrefBase="/portal/docs?id=" />
      </div>
      <div className={styles.m2}>
        <TodayCards />
        {logistics && <LogisticsDayCard />}
      </div>
      <div className={`${heroStyles.row} ${styles.m3}`}>
        <NextEventHero event={event} />
        {term && (
          <div className={styles.deskOnly}>
            <TermProgress term={term} />
          </div>
        )}
      </div>
      {myDivisions.length > 0 && (
        <section className={`${styles.divCards} ${styles.m6}`} aria-label="Your divisions">
          {myDivisions.map((d) => (
            <Link key={d.slug} href={`/portal/${d.slug}`} className={styles.divCard} style={{ ['--hat' as string]: d.accent }}>
              {d.logoUrl ? (
                <Image src={d.logoUrl} alt="" width={40} height={40} className={styles.divLogo} unoptimized />
              ) : (
                <span className={styles.divLogoFallback}>{d.name.slice(0, 1)}</span>
              )}
              <span>
                <strong>{d.name}</strong>
                <small>{d.level}</small>
              </span>
              <b aria-hidden="true">→</b>
            </Link>
          ))}
        </section>
      )}
      {explore.length > 0 && (
        <section className={`${styles.divCards} ${styles.m6}`} aria-label="Explore the divisions">
          {explore.map((d) => (
            <a key={d.slug} href={`/${d.slug}`} className={styles.divCard} style={{ ['--hat' as string]: d.accent }}>
              {d.logoUrl ? (
                <Image src={d.logoUrl} alt="" width={40} height={40} className={styles.divLogo} unoptimized />
              ) : (
                <span className={styles.divLogoFallback}>{d.name.slice(0, 1)}</span>
              )}
              <span>
                <strong>{d.name}</strong>
                <small>Visit the division</small>
              </span>
              <b aria-hidden="true">→</b>
            </a>
          ))}
        </section>
      )}
      {pins.length > 0 && (
        <nav className={`${styles.pins} ${styles.pinsDesk}`} aria-label="Pinned pages">
          <span className={styles.pinsLabel}>Your pins</span>
          {pins.map((p) => (
            <Link key={p.id} href={`/portal/${p.id}`} className={styles.pinChip}>
              {p.label}
            </Link>
          ))}
        </nav>
      )}
      <div className={styles.m5}>
        <HomeCards cards={cards} />
      </div>
      <div className={styles.m4}>
        <DashboardCode />
      </div>
      <div className={`${styles.deskGrid} ${styles.m7}`}>
        <div className={styles.deskMain}>
          {event && cards.length === 0 && (
            <article className={styles.ticket} aria-label="Next up">
              <span className={styles.tape} aria-hidden="true" />
              <div className={styles.ticketMain}>
                <span className={styles.sticker}>Next up</span>
                <h2 className={styles.eventTitle}>{event.title}</h2>
                <p className={styles.when}>
                  {day(event.start_date)} · {time(event.start_date)}
                </p>
                <EventCountdown startsAt={event.start_date} />
                {event.location && (
                  <p className={styles.where}>
                    <MapPin size={14} aria-hidden="true" /> {event.location}
                  </p>
                )}
                <div className={styles.actions}>
                  <Link href={event.hasTicket && event.ticketId ? `/portal/tickets?qr=${event.ticketId}` : '/portal/tickets'} className={styles.primary}>
                    {event.hasTicket ? (
                      <>
                        <CodeIcon size={16} use="ticket" /> Show My <CodeName use="ticket" />
                      </>
                    ) : (
                      <>
                        <Ticket size={16} aria-hidden="true" /> Get my ticket
                      </>
                    )}
                  </Link>
                </div>
              </div>
              <div className={styles.stub} aria-hidden="true">
                <span>Admit one</span>
              </div>
            </article>
          )}
          {showRoleAsk && compact && <RoleAsk />}
          {attention.length > 0 && (
            <section className={`${styles.panel} ${styles.deskOnly}`} aria-label="Needs your attention">
              <h2 className={styles.panelTitle}>
                Needs your attention <span className={styles.panelCount}>{attention.length}</span>
              </h2>
              <ul className={styles.panelList}>
                {attention.map((a) => (
                  <li key={a.id}>
                    <Link href={a.href ?? '/portal'} className={styles.panelRow}>
                      <span className={styles.panelText}>
                        <strong>{a.title}</strong>
                        {a.body && <small>{a.body}</small>}
                      </span>
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
                      <span className={styles.panelText}>
                        <strong>{a.title}</strong>
                      </span>
                      <span className={styles.panelWhen}>{ago(a.at)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
        <div className={styles.deskSide}>
          {stats.length > 0 && cards.length === 0 && (
            <section className={`${styles.panel} ${styles.deskOnly}`} aria-label="My numbers">
              <h2 className={styles.panelTitle}>My numbers</h2>
              <div className={styles.statGrid}>
                {stats.map((x) => (
                  <Link key={x.label} href={x.href} className={styles.stat}>
                    <span className={styles.statLabel}>{x.label}</span>
                    <b className={styles.statValue}>{x.value}</b>
                    <small className={styles.statSub}>{x.sub}</small>
                    {x.progress !== undefined && (
                      <span className={styles.statBar}>
                        <span style={{ width: `${x.progress}%` }} />
                      </span>
                    )}
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
              <Link href={note.href} className={styles.noteLink}>
                Read the full post →
              </Link>
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

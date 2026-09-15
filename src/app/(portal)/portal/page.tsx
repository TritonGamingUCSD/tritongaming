import Link from 'next/link';
import Image from 'next/image';
import { getProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { hasRole, canEditContent, ROLE_LABELS, ROLE_COLORS } from '@/types/database';
import DashboardClient from './DashboardClient';
import styles from './dashboard.module.css';

export const dynamic = 'force-dynamic';

export default async function PortalDashboard() {
  const profile = await getProfile();
  if (!profile) return null;

  const supabase = await createClient();
  const now = new Date().toISOString();
  const weekAhead = new Date(Date.now() + 7 * 86400_000).toISOString();

  const [
    ticketsRes,
    upcomingRes,
    eventsThisWeekRes,
    checkinStatsRes,
  ] = await Promise.all([
    supabase.from('tickets')
      .select('id, ticket_code, status, event:events(id, title, start_date, location)')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(5),

    supabase.from('events')
      .select('id, title, start_date, location, requires_ticket')
      .eq('is_published', true)
      .gte('start_date', now)
      .lte('start_date', weekAhead)
      .order('start_date', { ascending: true })
      .limit(5),

    hasRole(profile.role, 'officer')
      ? supabase.from('events')
          .select('id, title, start_date')
          .eq('is_published', true)
          .gte('start_date', now)
          .lte('start_date', weekAhead)
          .limit(10)
      : Promise.resolve({ data: [] }),

    // For officers: get checkin stats for active events
    hasRole(profile.role, 'officer')
      ? supabase.from('events')
          .select('id, title, start_date')
          .eq('is_published', true)
          .gte('start_date', new Date(Date.now() - 24 * 3600_000).toISOString())
          .lte('start_date', new Date(Date.now() + 24 * 3600_000).toISOString())
          .order('start_date', { ascending: true })
          .limit(3)
      : Promise.resolve({ data: [] }),
  ]);

  const myTickets = (ticketsRes.data ?? []) as unknown as Array<{
    id: string; ticket_code: string; status: string;
    event: { id: string; title: string; start_date: string; location: string | null } | null;
  }>;
  const upcomingEvents = (upcomingRes.data ?? []) as Array<{ id: string; title: string; start_date: string; location: string | null; requires_ticket: boolean }>;
  const eventsThisWeek = (eventsThisWeekRes as { data: Array<{ id: string; title: string; start_date: string }> | null }).data ?? [];
  const todayEvents = (checkinStatsRes as { data: Array<{ id: string; title: string; start_date: string }> | null }).data ?? [];

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  // Find next active ticket for upcoming event
  const nextTicket = myTickets.find((t) =>
    t.status === 'active' && t.event && new Date(t.event.start_date) >= new Date()
  );

  const statCards = [
    {
      icon: '🎟️', label: 'Active Tickets',
      value: myTickets.filter((t) => t.status === 'active').length,
      href: '/portal/tickets', color: '#0ea5e9',
    },
    ...(hasRole(profile.role, 'officer') ? [{
      icon: '🗓️', label: 'Events This Week',
      value: eventsThisWeek.length, href: '/portal/events', color: '#059669',
    }] : []),
  ];

  const quickActions = [
    { href: '/portal/profile',  icon: '👤', label: 'Profile' },
    { href: '/events',          icon: '🗓️', label: 'Events' },
    { href: '/divisions',       icon: '🎮', label: 'Divisions' },
    ...(hasRole(profile.role, 'officer') ? [
      { href: '/portal/events', icon: '➕', label: 'Add Event' },
      { href: '/portal/checkin',icon: '📷', label: 'Check-In' },
    ] : []),
    ...(canEditContent(profile.role) ? [
      { href: '/portal/admin/content', icon: '✏️', label: 'Edit Site' },
    ] : []),
    ...(hasRole(profile.role, 'exec') ? [
      { href: '/portal/admin',  icon: '🛡️', label: 'Admin' },
    ] : []),
  ];

  return (
    <div className={styles.page}>

      {/* ── Header ─────────────────────────────────── */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          {profile.avatar_url ? (
            <Image
              src={profile.avatar_url}
              alt={profile.display_name || 'User'}
              width={48}
              height={48}
              className={styles.headerAvatar}
            />
          ) : (
            <div className={styles.headerAvatarFallback}>
              {(profile.display_name || 'U')[0].toUpperCase()}
            </div>
          )}
          <div>
            <p className={styles.greeting}>{greeting}, {profile.display_name?.split(' ')[0] || 'Triton'}</p>
            <span
              className={styles.roleChip}
              style={{ background: ROLE_COLORS[profile.role] + '18', color: ROLE_COLORS[profile.role], borderColor: ROLE_COLORS[profile.role] + '44' }}
            >
              {ROLE_LABELS[profile.role]}
            </span>
          </div>
        </div>
      </header>

      {/* ── Officer: Today's check-in shortcut ─────── */}
      {hasRole(profile.role, 'officer') && todayEvents.length > 0 && (
        <Link href="/portal/checkin" className={styles.checkinBanner}>
          <div className={styles.checkinBannerDot} />
          <div>
            <div className={styles.checkinBannerTitle}>Event today — {todayEvents[0].title}</div>
            <div className={styles.checkinBannerSub}>Tap to open check-in scanner</div>
          </div>
          <span className={styles.checkinBannerIcon}>📷</span>
        </Link>
      )}

      {/* ── Member: Next ticket hero ────────────────── */}
      {nextTicket && !hasRole(profile.role, 'officer') && (
        <DashboardClient ticket={nextTicket as Parameters<typeof DashboardClient>[0]['ticket']} />
      )}

      {/* ── Stat cards ─────────────────────────────── */}
      {statCards.length > 0 && (
        <div className={styles.statRow}>
          {statCards.map((s) => (
            <Link key={s.label} href={s.href}
              className={styles.statCard}
              style={{ '--stat-color': s.color } as React.CSSProperties}>
              <span className={styles.statIcon}>{s.icon}</span>
              <div>
                <div className={styles.statValue} style={{ color: s.color }}>{s.value}</div>
                <div className={styles.statLabel}>{s.label}</div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className={styles.twoCol}>
        <div className={styles.mainCol}>

          {/* ── Upcoming events ─────────────────────── */}
          {upcomingEvents.length > 0 && (
            <section className={styles.section}>
              <div className={styles.sectionRow}>
                <h2 className={styles.sectionLabel}>Upcoming Events</h2>
                <Link href="/events" className={styles.seeAll}>See all →</Link>
              </div>
              <div className={styles.eventList}>
                {upcomingEvents.map((event) => {
                  const d = new Date(event.start_date);
                  const hasTicket = myTickets.some((t) => t.event?.id === event.id);
                  return (
                    <div key={event.id} className={styles.eventRow}>
                      <div className={styles.eventDateBlock}>
                        <span className={styles.eventMon}>{d.toLocaleDateString('en-US', { month: 'short' })}</span>
                        <span className={styles.eventDay}>{d.getDate()}</span>
                      </div>
                      <div className={styles.eventBody}>
                        <div className={styles.eventTitle}>{event.title}</div>
                        <div className={styles.eventMeta}>
                          {d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                          {event.location && ` · ${event.location}`}
                        </div>
                      </div>
                      <div className={styles.eventActions}>
                        {hasTicket ? (
                          <Link href="/portal/tickets" className={styles.ticketBadge}>✓ Registered</Link>
                        ) : event.requires_ticket ? (
                          <Link href="/portal/tickets" className={styles.getTicket}>Get Ticket</Link>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* ── My recent tickets ────────────────────── */}
          {myTickets.length > 0 && (
            <section className={styles.section}>
              <div className={styles.sectionRow}>
                <h2 className={styles.sectionLabel}>My Tickets</h2>
                <Link href="/portal/tickets" className={styles.seeAll}>View all →</Link>
              </div>
              <div className={styles.ticketList}>
                {myTickets.slice(0, 3).map((ticket) => (
                  <div key={ticket.id} className={styles.ticketRow}>
                    <span className={`${styles.ticketStatus} ${ticket.status === 'used' ? styles.ticketUsed : ''}`}>
                      {ticket.status === 'used' ? '✓' : '🎟️'}
                    </span>
                    <div className={styles.ticketInfo}>
                      <div className={styles.ticketEvent}>{ticket.event?.title || 'Unknown event'}</div>
                      {ticket.event?.start_date && (
                        <div className={styles.ticketDate}>
                          {new Date(ticket.event.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                      )}
                    </div>
                    <span className={`${styles.ticketBadgeSmall} ${ticket.status === 'used' ? styles.ticketBadgeUsed : styles.ticketBadgeActive}`}>
                      {ticket.status}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className={styles.sideCol}>
          {/* ── Quick actions ────────────────────────── */}
          <section className={styles.section}>
            <h2 className={styles.sectionLabel}>Quick Access</h2>
            <div className={styles.quickGrid}>
              {quickActions.map(({ href, icon, label }) => (
                <Link key={href} href={href} className={styles.quickCard}>
                  <span className={styles.quickIcon}>{icon}</span>
                  <span className={styles.quickLabel}>{label}</span>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

import Link from 'next/link';
import { getProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { hasRole, canEditContent, ROLE_LABELS, ROLE_COLORS } from '@/types/database';
import styles from './dashboard.module.css';

export const dynamic = 'force-dynamic';

export default async function PortalDashboard() {
  const profile = await getProfile();
  if (!profile) return null;

  const supabase = await createClient();
  const now = new Date().toISOString();
  const weekAhead = new Date(Date.now() + 7 * 86400_000).toISOString();

  // Fetch data in parallel, scoped to the user's role
  const [
    ticketsRes,
    myPostsRes,
    upcomingRes,
    pendingRes,
    eventsThisWeekRes,
    divisionRes,
    recentPostsRes,
  ] = await Promise.all([
    supabase.from('tickets').select('id, status, event:events(title, start_date)')
      .eq('user_id', profile.id).order('created_at', { ascending: false }).limit(3),

    supabase.from('board_posts').select('id', { count: 'exact', head: true })
      .eq('author_id', profile.id),

    supabase.from('events').select('id, title, start_date, location, requires_ticket')
      .eq('is_published', true).gte('start_date', now).lte('start_date', weekAhead)
      .order('start_date', { ascending: true }).limit(5),

    hasRole(profile.role, 'exec')
      ? supabase.from('member_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending')
      : Promise.resolve({ count: 0 }),

    hasRole(profile.role, 'officer')
      ? supabase.from('events').select('id, title, start_date').eq('is_published', true)
          .gte('start_date', now).lte('start_date', weekAhead).limit(10)
      : Promise.resolve({ data: [] }),

    profile.division_id
      ? supabase.from('divisions').select('name, slug, color').eq('id', profile.division_id).single()
      : Promise.resolve({ data: null }),

    supabase.from('board_posts')
      .select('id, title, score, comment_count, created_at, category:board_categories(slug, name, color, icon)')
      .order('created_at', { ascending: false }).limit(4),
  ]);

  const myTickets = (ticketsRes.data ?? []) as Array<{
    id: string; status: string;
    event: { title: string; start_date: string } | Array<{ title: string; start_date: string }> | null;
  }>;
  const myPostCount = myPostsRes.count ?? 0;
  const upcomingEvents = (upcomingRes.data ?? []) as Array<{ id: string; title: string; start_date: string; location: string | null; requires_ticket: boolean }>;
  const pendingCount = (pendingRes as { count: number }).count ?? 0;
  const eventsThisWeek = (eventsThisWeekRes as { data: Array<{ id: string; title: string; start_date: string }> | null }).data ?? [];
  const myDivision = (divisionRes as { data: { name: string; slug: string; color: string } | null }).data;
  const recentPosts = (recentPostsRes.data ?? []) as Array<{
    id: string; title: string; score: number; comment_count: number; created_at: string;
    category: { slug: string; name: string; color: string; icon: string } | Array<{ slug: string; name: string; color: string; icon: string }> | null;
  }>;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  // Role-aware stat cards
  const statCards = [
    {
      icon: '🎟️', label: 'Active Tickets',
      value: myTickets.filter((t) => t.status === 'active').length,
      href: '/portal/tickets', color: '#0ea5e9',
    },
    {
      icon: '💬', label: 'My Posts',
      value: myPostCount, href: '/board', color: '#7c3aed',
    },
    ...(hasRole(profile.role, 'officer') ? [{
      icon: '🗓️', label: 'Events This Week',
      value: eventsThisWeek.length, href: '/portal/events', color: '#059669',
    }] : []),
    ...(hasRole(profile.role, 'exec') && pendingCount > 0 ? [{
      icon: '⏳', label: 'Pending Requests',
      value: pendingCount, href: '/portal/admin', color: '#ffc72c', highlight: true,
    }] : []),
  ];

  return (
    <div className={styles.page}>

      {/* ── Header ─────────────────────────────────── */}
      <header className={styles.header}>
        <div>
          <h1 className={styles.greeting}>
            {greeting}, {profile.display_name?.split(' ')[0] || 'Triton'}
          </h1>
          <p className={styles.sub}>
            {ROLE_LABELS[profile.role]} · Triton Gaming Member Portal
          </p>
        </div>
        <span className={styles.roleChip}
          style={{ background: ROLE_COLORS[profile.role] + '18', color: ROLE_COLORS[profile.role], borderColor: ROLE_COLORS[profile.role] + '44' }}>
          {ROLE_LABELS[profile.role]}
        </span>
      </header>

      {/* ── Attention banner (exec+) ────────────────── */}
      {pendingCount > 0 && hasRole(profile.role, 'exec') && (
        <Link href="/portal/admin" className={styles.alertBanner}>
          <span className={styles.alertDot} />
          <strong>{pendingCount}</strong> pending membership request{pendingCount !== 1 ? 's' : ''} waiting for review
          <span className={styles.alertArrow}>Review →</span>
        </Link>
      )}

      {/* ── Stat cards ─────────────────────────────── */}
      {statCards.length > 0 && (
        <div className={styles.statRow}>
          {statCards.map((s) => (
            <Link key={s.label} href={s.href}
              className={`${styles.statCard} ${s.highlight ? styles.statHighlight : ''}`}
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

          {/* ── My division ─────────────────────────── */}
          {myDivision && (
            <section className={styles.section}>
              <h2 className={styles.sectionLabel}>My Division</h2>
              <Link href={`/divisions/${myDivision.slug}`} className={styles.divisionCard}
                style={{ borderColor: myDivision.color + '44' }}>
                <div className={styles.divisionDot} style={{ background: myDivision.color }} />
                <span className={styles.divisionName}>{myDivision.name}</span>
                <span className={styles.divisionLink}>View page →</span>
              </Link>
            </section>
          )}

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
                  const hasTicket = myTickets.some((t) => {
                    const ev = Array.isArray(t.event) ? t.event[0] : t.event;
                    return ev?.title === event.title;
                  });
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
                          <span className={styles.ticketBadge}>✓ Registered</span>
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
                {myTickets.map((ticket) => {
                  const ev = Array.isArray(ticket.event) ? ticket.event[0] : ticket.event;
                  return (
                    <div key={ticket.id} className={styles.ticketRow}>
                      <span className={`${styles.ticketStatus} ${ticket.status === 'used' ? styles.ticketUsed : ''}`}>
                        {ticket.status === 'used' ? '✓' : '🎟️'}
                      </span>
                      <div className={styles.ticketInfo}>
                        <div className={styles.ticketEvent}>{ev?.title || 'Unknown event'}</div>
                        {ev?.start_date && (
                          <div className={styles.ticketDate}>
                            {new Date(ev.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </div>
                        )}
                      </div>
                      <span className={`${styles.ticketBadgeSmall} ${ticket.status === 'used' ? styles.ticketBadgeUsed : styles.ticketBadgeActive}`}>
                        {ticket.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        <div className={styles.sideCol}>
          {/* ── Quick actions ────────────────────────── */}
          <section className={styles.section}>
            <h2 className={styles.sectionLabel}>Quick Access</h2>
            <div className={styles.quickGrid}>
              {[
                { href: '/portal/profile',  icon: '👤', label: 'Profile' },
                { href: '/board',           icon: '💬', label: 'Board' },
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
              ].map(({ href, icon, label }) => (
                <Link key={href} href={href} className={styles.quickCard}>
                  <span className={styles.quickIcon}>{icon}</span>
                  <span className={styles.quickLabel}>{label}</span>
                </Link>
              ))}
            </div>
          </section>

          {/* ── Recent board posts ───────────────────── */}
          {recentPosts.length > 0 && (
            <section className={styles.section}>
              <div className={styles.sectionRow}>
                <h2 className={styles.sectionLabel}>Recent Posts</h2>
                <Link href="/board" className={styles.seeAll}>Board →</Link>
              </div>
              <div className={styles.postList}>
                {recentPosts.map((post) => {
                  const cat = Array.isArray(post.category) ? post.category[0] : post.category;
                  return (
                    <Link
                      key={post.id}
                      href={`/board/${cat?.slug}/${post.id}`}
                      className={styles.postRow}
                    >
                      <span className={styles.postCatIcon}>{cat?.icon}</span>
                      <div className={styles.postInfo}>
                        <div className={styles.postTitle}>{post.title}</div>
                        <div className={styles.postMeta}>
                          ▲ {post.score} · 💬 {post.comment_count} ·{' '}
                          {new Date(post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

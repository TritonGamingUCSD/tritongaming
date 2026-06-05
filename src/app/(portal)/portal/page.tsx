import Link from 'next/link';
import { getProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { hasRole, ROLE_LABELS, ROLE_COLORS } from '@/types/database';
import styles from './dashboard.module.css';

export const dynamic = 'force-dynamic';

export default async function PortalDashboard() {
  const profile = await getProfile();
  if (!profile) return null;

  const supabase = await createClient();

  const [ticketsRes, upcomingRes] = await Promise.all([
    supabase.from('tickets').select('id').eq('user_id', profile.id),
    supabase
      .from('events')
      .select('id, title, start_date, location')
      .eq('is_published', true)
      .gte('start_date', new Date().toISOString())
      .order('start_date', { ascending: true })
      .limit(3),
  ]);

  const ticketCount = ticketsRes.data?.length ?? 0;
  const upcomingEvents = upcomingRes.data ?? [];

  const quickLinks = [
    { href: '/portal/tickets', label: 'My Tickets', icon: '🎟️', desc: `${ticketCount} ticket${ticketCount !== 1 ? 's' : ''}` },
    { href: '/portal/profile', label: 'Edit Profile', icon: '👤', desc: 'Update your info' },
    { href: '/board', label: 'Discussion Board', icon: '💬', desc: 'Join the conversation' },
    { href: '/divisions', label: 'Divisions', icon: '🎮', desc: 'Browse all divisions' },
    ...(hasRole(profile.role, 'officer')
      ? [{ href: '/portal/events', label: 'Manage Events', icon: '🗓️', desc: 'Create & edit events' }]
      : []),
    ...(hasRole(profile.role, 'officer')
      ? [{ href: '/portal/checkin', label: 'Check-In Scanner', icon: '📷', desc: 'Scan tickets at events' }]
      : []),
    ...(hasRole(profile.role, 'admin')
      ? [{ href: '/portal/admin', label: 'Admin Panel', icon: '🛡️', desc: 'Manage the platform' }]
      : []),
  ];

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.greeting}>
            {greeting}, {profile.display_name?.split(' ')[0] || 'Triton'}!
          </h1>
          <p className={styles.sub}>Welcome to the Triton Gaming member portal.</p>
        </div>
        <span
          className={styles.roleChip}
          style={{ background: ROLE_COLORS[profile.role] + '22', color: ROLE_COLORS[profile.role] }}
        >
          {ROLE_LABELS[profile.role]}
        </span>
      </header>

      <section className={styles.quickLinks}>
        <h2 className={styles.sectionTitle}>Quick Access</h2>
        <div className={styles.grid}>
          {quickLinks.map(({ href, label, icon, desc }) => (
            <Link key={href} href={href} className={styles.card}>
              <span className={styles.cardIcon}>{icon}</span>
              <div>
                <div className={styles.cardLabel}>{label}</div>
                <div className={styles.cardDesc}>{desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {upcomingEvents.length > 0 && (
        <section className={styles.upcoming}>
          <h2 className={styles.sectionTitle}>Upcoming Events</h2>
          <div className={styles.eventList}>
            {upcomingEvents.map((event) => {
              const date = new Date(event.start_date);
              return (
                <div key={event.id} className={styles.eventRow}>
                  <div className={styles.eventDate}>
                    <span className={styles.eventDay}>
                      {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                    <span className={styles.eventTime}>
                      {date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className={styles.eventInfo}>
                    <div className={styles.eventTitle}>{event.title}</div>
                    {event.location && (
                      <div className={styles.eventLocation}>{event.location}</div>
                    )}
                  </div>
                  <Link href="/events" className={styles.eventLink}>View →</Link>
                </div>
              );
            })}
          </div>
          <Link href="/events" className={styles.viewAll}>View all events →</Link>
        </section>
      )}
    </div>
  );
}

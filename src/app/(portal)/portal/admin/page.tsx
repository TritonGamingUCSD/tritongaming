import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/auth';
import { hasRole } from '@/types/database';
import { createClient } from '@/lib/supabase/server';
import RoleManager from './RoleManager';
import styles from './admin.module.css';

export const metadata = { title: 'Admin Panel' };
export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const profile = await getProfile();
  if (!profile || !hasRole(profile.role, 'admin')) redirect('/portal');

  const supabase = await createClient();

  const [usersRes, eventsRes, postsRes, ticketsRes, pendingRes] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('events').select('id', { count: 'exact', head: true }),
    supabase.from('board_posts').select('id', { count: 'exact', head: true }),
    supabase.from('tickets').select('id', { count: 'exact', head: true }),
    supabase.from('member_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
  ]);

  const stats = [
    { label: 'Total Users',   value: usersRes.count ?? 0,   icon: '👥', href: '/portal/members' },
    { label: 'Events',        value: eventsRes.count ?? 0,  icon: '🗓️', href: '/portal/events' },
    { label: 'Board Posts',   value: postsRes.count ?? 0,   icon: '💬', href: '/board' },
    { label: 'Tickets Issued',value: ticketsRes.count ?? 0, icon: '🎟️', href: null },
    { label: 'Pending Requests', value: pendingRes.count ?? 0, icon: '⏳', href: '/portal/members' },
  ];

  const { data: allUsers } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url, role, gamer_tag, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Admin Panel</h1>
          <p className={styles.titleSub}>Platform management and configuration</p>
        </div>
        <Link href="/portal/admin/content" className={styles.cmsBtn}>
          ✏️ Edit Website Content
        </Link>
      </div>

      {/* Stats */}
      <div className={styles.statsGrid}>
        {stats.map(({ label, value, icon, href }) => {
          const el = (
            <div className={`${styles.statCard} ${href ? styles.statCardLink : ''}`}>
              <span className={styles.statIcon}>{icon}</span>
              <div>
                <div className={styles.statValue}>{value.toLocaleString()}</div>
                <div className={styles.statLabel}>{label}</div>
              </div>
              {href && <span className={styles.statArrow}>→</span>}
            </div>
          );
          return href ? (
            <Link key={label} href={href}>{el}</Link>
          ) : (
            <div key={label}>{el}</div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <section className={styles.section}>
        <h2 className={styles.sectionLabel}>Quick Actions</h2>
        <div className={styles.actions}>
          {[
            { href: '/portal/admin/content', icon: '✏️', label: 'Edit Site Content', desc: 'Banners, stats, text' },
            { href: '/portal/members',       icon: '👥', label: 'Manage Members',    desc: 'Approve requests' },
            { href: '/portal/events',        icon: '🗓️', label: 'Manage Events',    desc: 'Create & edit' },
            { href: '/portal/checkin',       icon: '📷', label: 'Check-In Scanner', desc: 'Scan QR codes' },
          ].map(({ href, icon, label, desc }) => (
            <Link key={href} href={href} className={styles.actionCard}>
              <span className={styles.actionIcon}>{icon}</span>
              <div>
                <div className={styles.actionLabel}>{label}</div>
                <div className={styles.actionDesc}>{desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Role Manager — interactive, client component */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionLabel}>Role Manager</h2>
          <span className={styles.sectionHint}>Search and update any user's role instantly</span>
        </div>
        <RoleManager users={(allUsers ?? []) as unknown as Parameters<typeof RoleManager>[0]['users']} />
      </section>
    </div>
  );
}

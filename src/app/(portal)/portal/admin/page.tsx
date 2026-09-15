import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/auth';
import { hasRole } from '@/types/database';
import { createClient } from '@/lib/supabase/server';
import RoleManager from './RoleManager';
import PendingRequests from './PendingRequests';
import styles from './admin.module.css';

export const metadata = { title: 'Admin' };
export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const profile = await getProfile();
  if (!profile || !hasRole(profile.role, 'exec')) redirect('/portal');

  const isAdmin = hasRole(profile.role, 'admin');
  const supabase = await createClient();

  const [usersRes, eventsRes, ticketsRes, pendingRes] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('events').select('id', { count: 'exact', head: true }),
    supabase.from('tickets').select('id', { count: 'exact', head: true }),
    supabase.from('member_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
  ]);

  const stats = [
    { label: 'Members',  value: usersRes.count   ?? 0, icon: '👥' },
    { label: 'Events',   value: eventsRes.count  ?? 0, icon: '🗓️' },
    { label: 'Tickets',  value: ticketsRes.count ?? 0, icon: '🎟️' },
    { label: 'Pending',  value: pendingRes.count ?? 0, icon: '⏳', highlight: (pendingRes.count ?? 0) > 0 },
  ];

  // Pending requests (for exec+)
  const { data: requestsRaw } = await supabase
    .from('member_requests')
    .select(`id, requested_role, message, status, created_at, user:profiles(id, display_name, avatar_url)`)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  const requests = (requestsRaw ?? []) as unknown as Parameters<typeof PendingRequests>[0]['requests'];

  // All users — only load for admin (full role manager)
  let allUsers: Parameters<typeof RoleManager>[0]['users'] = [];
  if (isAdmin) {
    const { data: usersData } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url, role, gamer_tag, created_at')
      .order('created_at', { ascending: false })
      .limit(300);
    allUsers = (usersData ?? []) as unknown as typeof allUsers;
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Admin</h1>
          <p className={styles.titleSub}>Platform management</p>
        </div>
        <Link href="/portal/admin/content" className={styles.cmsBtn}>
          ✏️ Edit Site Content
        </Link>
      </div>

      {/* Stats */}
      <div className={styles.statsGrid}>
        {stats.map(({ label, value, icon, highlight }) => (
          <div key={label} className={`${styles.statCard} ${highlight ? styles.statHighlight : ''}`}>
            <span className={styles.statIcon}>{icon}</span>
            <div>
              <div className={styles.statValue}>{value.toLocaleString()}</div>
              <div className={styles.statLabel}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <section className={styles.section}>
        <h2 className={styles.sectionLabel}>Quick Actions</h2>
        <div className={styles.actions}>
          {[
            { href: '/portal/admin/content', icon: '✏️', label: 'Edit Site Content', desc: 'Banners, stats, text' },
            { href: '/portal/events',        icon: '🗓️', label: 'Manage Events',    desc: 'Create & edit' },
            { href: '/portal/checkin',       icon: '📷', label: 'Check-In Scanner', desc: 'Scan QR codes' },
            { href: '/board',                icon: '💬', label: 'Discussion Board',  desc: 'Community posts' },
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

      {/* Pending member requests (exec+) */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionLabel}>Member Requests</h2>
          {requests.length > 0 && (
            <span className={styles.badge}>{requests.length} pending</span>
          )}
        </div>
        <PendingRequests requests={requests} />
      </section>

      {/* Full role manager (admin only) */}
      {isAdmin && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionLabel}>Role Manager</h2>
            <span className={styles.sectionHint}>Search any user and change their role instantly</span>
          </div>
          <RoleManager users={allUsers} />
        </section>
      )}
    </div>
  );
}

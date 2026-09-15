import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getUserRoles } from '@/lib/auth';
import { hasCapability } from '@/lib/capabilities';
import { createClient } from '@/lib/supabase/server';
import RoleManager from './RoleManager';
import styles from './admin.module.css';

export const metadata = { title: 'Admin' };
export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const roles = await getUserRoles();
  if (!hasCapability(roles, 'view_admin_dashboard')) redirect('/portal');

  const isAdmin = hasCapability(roles, 'manage_roles');
  const supabase = await createClient();

  const [usersRes, eventsRes, ticketsRes] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('events').select('id', { count: 'exact', head: true }),
    supabase.from('tickets').select('id', { count: 'exact', head: true }),
  ]);

  const stats = [
    { label: 'Members',  value: usersRes.count   ?? 0, icon: '👥' },
    { label: 'Events',   value: eventsRes.count  ?? 0, icon: '🗓️' },
    { label: 'Tickets',  value: ticketsRes.count ?? 0, icon: '🎟️' },
  ];

  // All users + their role grants, and the division picker list — only
  // loaded for admins (full role manager).
  let allUsers: Parameters<typeof RoleManager>[0]['users'] = [];
  let divisions: Parameters<typeof RoleManager>[0]['divisions'] = [];
  if (isAdmin) {
    const [{ data: usersData }, { data: divisionsData }] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, display_name, avatar_url, gamer_tag, created_at, user_roles(role, division_id)')
        .order('created_at', { ascending: false })
        .limit(300),
      supabase.from('divisions').select('id, name').order('name'),
    ]);
    allUsers = (usersData ?? []) as unknown as typeof allUsers;
    divisions = divisionsData ?? [];
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
        {stats.map(({ label, value, icon }) => (
          <div key={label} className={styles.statCard}>
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

      {/* Full role manager (admin only) */}
      {isAdmin && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionLabel}>Role Manager</h2>
            <span className={styles.sectionHint}>Search any user and change their role instantly</span>
          </div>
          <RoleManager users={allUsers} divisions={divisions} />
        </section>
      )}
    </div>
  );
}

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

  const [usersRes, eventsRes, ticketsRes, eventStatsRes, ticketStatsRes] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('events').select('id', { count: 'exact', head: true }),
    supabase.from('tickets').select('id', { count: 'exact', head: true }),
    supabase.from('events').select('id, title, start_date').order('start_date', { ascending: false }).limit(20),
    supabase.from('tickets').select('event_id, status'),
  ]);

  const stats = [
    { label: 'Members',  value: usersRes.count   ?? 0, icon: '👥' },
    { label: 'Events',   value: eventsRes.count  ?? 0, icon: '🗓️' },
    { label: 'Tickets',  value: ticketsRes.count ?? 0, icon: '🎟️' },
  ];

  // Per-event ticket/check-in breakdown, for admins and execs.
  const ticketCountsByEvent: Record<string, { issued: number; checkedIn: number }> = {};
  (ticketStatsRes.data ?? []).forEach((t) => {
    const bucket = ticketCountsByEvent[t.event_id] ??= { issued: 0, checkedIn: 0 };
    if (t.status === 'active' || t.status === 'used') bucket.issued++;
    if (t.status === 'used') bucket.checkedIn++;
  });
  const eventTicketStats = (eventStatsRes.data ?? [])
    .map((e) => ({ ...e, ...(ticketCountsByEvent[e.id] ?? { issued: 0, checkedIn: 0 }) }))
    .filter((e) => e.issued > 0);

  // All users + their role grants, and the division picker list — only
  // loaded for admins (full role manager).
  let allUsers: Parameters<typeof RoleManager>[0]['users'] = [];
  let divisions: Parameters<typeof RoleManager>[0]['divisions'] = [];
  if (isAdmin) {
    // user_roles has TWO foreign keys into profiles (user_id and
    // granted_by), so embedding it from profiles without a hint is
    // ambiguous to PostgREST — it errors, and unchecked that silently
    // becomes an empty result (same bug as the checkin ticket lookup).
    const [{ data: usersData, error: usersError }, { data: divisionsData }] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, display_name, avatar_url, gamer_tag, created_at, user_roles!user_roles_user_id_fkey(role, division_id)')
        .order('created_at', { ascending: false })
        .limit(300),
      supabase.from('divisions').select('id, name, slug').order('name'),
    ]);
    if (usersError) console.error('[admin] failed to load users:', usersError);
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
            { href: '/portal/divisions',     icon: '🎮', label: 'Divisions',        desc: 'Manage the directory' },
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

      {/* Ticket & check-in stats (exec+) */}
      {eventTicketStats.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionLabel}>Ticket & Check-In Stats</h2>
          <div className={styles.table}>
            <div className={styles.tableHeader}>
              <span>Event</span>
              <span>Tickets Issued</span>
              <span>Checked In</span>
            </div>
            {eventTicketStats.map((e) => (
              <div key={e.id} className={styles.tableRow}>
                <span>{e.title}</span>
                <span>{e.issued}</span>
                <span>{e.checkedIn} <span className={styles.sectionHint}>({e.issued > 0 ? Math.round((e.checkedIn / e.issued) * 100) : 0}%)</span></span>
              </div>
            ))}
          </div>
        </section>
      )}

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

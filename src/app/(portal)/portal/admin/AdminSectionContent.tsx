import Link from 'next/link';
import RoleManager from './RoleManager';
import styles from './admin.module.css';

interface Props {
  isAdmin: boolean;
  stats: { label: string; value: number; icon: string }[];
  eventTicketStats: { id: string; title: string; issued: number; checkedIn: number }[];
  allUsers: Parameters<typeof RoleManager>[0]['users'];
  divisions: Parameters<typeof RoleManager>[0]['divisions'];
}

// Shared between the standalone /portal/admin page and the portal hub's
// Admin panel, so the two never drift apart visually. The old inline "Quick
// Actions" card grid that used to live here was dropped — the hub's own
// card grid, one level up, already covers those same destinations.
export default function AdminSectionContent({ isAdmin, stats, eventTicketStats, allUsers, divisions }: Props) {
  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Admin</h1>
          <p className={styles.titleSub}>Platform management</p>
        </div>
        <Link href="/portal?open=content" className={styles.cmsBtn}>
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

'use client';

import SectionTabs from '@/components/ui/SectionTabs';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { ReactNode } from 'react';
import { LayoutDashboard, BarChart3, Activity, X, Server, Users as UsersIcon } from 'lucide-react';
import { usePortalTabSync, useUrlNav } from '@/lib/portal/usePortalTabSync';
import { resolveAvatarUrl } from '@/lib/members/profile';
import { PACIFIC_TZ, formatPacificDateTime } from '@/lib/core/timezone';
import RoleManager from './RoleManager';
import AccessPanel from './AccessPanel';
import SystemStats from './SystemStats';
import AdminOverviewPanels from './AdminOverviewPanels';
import StatsClient from './stats/StatsClient';
import type { StatsData } from './stats/getStatsData';
import AuditLogClient from './audit/AuditLogClient';
import LinksManager from '../links/LinksManager';
import RoleHistoryClient from './history/RoleHistoryClient';
import type { RoleChangeEntry } from './history/getRoleHistoryData';
import IconButton from '@/components/ui/IconButton';
import styles from './admin.module.css';
import SectionHeader from '@/components/ui/SectionHeader';

interface Props {
  isAdmin: boolean;
  stats: { label: string; value: number; icon: ReactNode }[];
  allUsers: Parameters<typeof RoleManager>[0]['users'];
  divisions: Parameters<typeof RoleManager>[0]['divisions'];
  statsData: StatsData;
  roleHistoryEntries?: RoleChangeEntry[];
  initialTab?: string;
}

type Tab = 'overview' | 'members' | 'access' | 'analytics' | 'audit-log' | 'short-links' | 'system';
const VALID_TABS: Tab[] = ['overview', 'members', 'access', 'analytics', 'audit-log', 'short-links', 'system'];
type Group = 'overview' | 'people' | 'insights' | 'system';
const GROUPS: Record<Group, { label: string; icon: ReactNode; views: Tab[] }> = {
  overview: { label: 'Overview', icon: <LayoutDashboard />, views: ['overview'] },
  people: { label: 'People', icon: <UsersIcon />, views: ['members', 'access'] },
  insights: { label: 'Insights', icon: <BarChart3 />, views: ['analytics', 'audit-log'] },
  system: { label: 'System', icon: <Server />, views: ['system', 'short-links'] },
};
const VIEW_LABELS: Record<Tab, string> = { overview: 'Overview', members: 'Member Management', access: 'Access', analytics: 'Analytics', 'audit-log': 'Audit Log', 'short-links': 'Short Links', system: 'System Health' };
const groupOf = (t: Tab): Group => (Object.keys(GROUPS) as Group[]).find((g) => GROUPS[g].views.includes(t)) ?? 'overview';

// Each tab is a real destination now instead of Overview being a junk
// drawer for Role Manager + Storage Cleanup stacked underneath the stats —
// those two are genuinely separate tasks an admin comes here to do, not
// something to scroll past on the way to them. Role History used to be a
// fourth tab of its own, but it's not a destination anyone visits on its
// own — it's a "how did we get here" lookup you reach for *from* Role
// Manager, so it's a small icon button there instead (see HistoryModal).
// The per-event ticket/check-in breakdown that used to live in Overview
// moved to the Events card's own Analytics tab — it's event data, not a
// platform-admin metric, and Events is where someone actually managing
// tickets for a specific event already is.
export default function AdminSectionContent({ isAdmin, stats, allUsers, divisions, statsData, roleHistoryEntries }: Props) {
  const { tab: initialTab } = useUrlNav();
  const [tab, setTab] = useState<Tab>(VALID_TABS.includes(initialTab as Tab) ? (initialTab as Tab) : 'overview');
  const syncUrl = usePortalTabSync('admin');
  const lastIn = useRef<Partial<Record<Group, Tab>>>({});
  const viewOk = (v: Tab) => v === 'overview' || v === 'analytics' || isAdmin;
  function selectTab(t: Tab) {
    setTab(t);
    lastIn.current[groupOf(t)] = t;
    syncUrl(t);
  }
  const [historyOpen, setHistoryOpen] = useState(false);

  // Who holds the admin role — filtered client-side from allUsers rather
  // than a separate query, since getAdminData.ts already loads every
  // user's role grants for Role Manager (isAdmin-gated the same way).
  const admins = allUsers.filter((u) => u.user_roles.some((r) => r.role === 'admin'));

  // Per-admin "what have they done lately" — see get_admin_activity in
  // 20260921150000_add_admin_activity_feed.sql for what it aggregates and
  // what it deliberately leaves out (tier edits aren't attributable to an
  // admin at the DB level yet).
  const [activityFor, setActivityFor] = useState<{ id: string; title: string } | null>(null);
  const [activityEntries, setActivityEntries] = useState<{ action: string; detail: string; occurred_at: string }[] | null>(null);
  const [activityError, setActivityError] = useState('');

  useEffect(() => {
    if (!activityFor) return;
    setActivityEntries(null);
    setActivityError('');
    (async () => {
      try {
        const res = await fetch(`/api/admin/activity?user_id=${activityFor.id}`);
        const json = await res.json();
        if (!res.ok) { setActivityError(json.error || 'Failed to load activity.'); return; }
        setActivityEntries(json.entries ?? []);
      } catch {
        setActivityError('Network error loading activity.');
      }
    })();
  }, [activityFor]);

  return (
    <div className={styles.page}>
      <SectionHeader title="Admin" sub="Platform management" />

      {/* Four groups instead of eight tabs. Each view keeps its own id in the address (tab=roles, tab=audit …), so every old link still works. */}
      <SectionTabs<Group>
        label="Admin"
        value={groupOf(tab)}
        onChange={(g) => selectTab(lastIn.current[g] && GROUPS[g].views.includes(lastIn.current[g]!) ? lastIn.current[g]! : GROUPS[g].views.filter((v) => viewOk(v))[0])}
        tabs={(Object.keys(GROUPS) as Group[]).filter((g) => GROUPS[g].views.some(viewOk)).map((g) => ({ id: g, label: GROUPS[g].label, icon: GROUPS[g].icon }))}
      />
      {GROUPS[groupOf(tab)].views.filter(viewOk).length > 1 && (
        <SectionTabs<Tab> variant="segmented" label={`${GROUPS[groupOf(tab)].label} views`} value={tab} onChange={selectTab}
          tabs={GROUPS[groupOf(tab)].views.filter(viewOk).map((v) => ({ id: v, label: VIEW_LABELS[v] }))} />
      )}

      {tab === 'overview' && (
        <>
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

        {isAdmin && <AdminOverviewPanels />}

        {isAdmin && (
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionLabel}>Admins</h2>
              <span className={styles.sectionHint}>Everyone with the admin role — click a name to see what they&apos;ve done lately</span>
            </div>
            {admins.length === 0 ? (
              <p className={styles.sectionHint}>No one currently holds the admin role.</p>
            ) : (
              <div className={styles.table}>
                <div className={styles.tableHeader}>
                  <span>Admin</span>
                  <span>Joined</span>
                  <span>Activity</span>
                </div>
                {admins.map((admin) => {
                  const avatarUrl = resolveAvatarUrl(admin);
                  return (
                    <div key={admin.id} className={styles.tableRow}>
                      <span className={styles.adminCell}>
                        {avatarUrl ? (
                          <Image src={avatarUrl} alt="" width={28} height={28} className={styles.adminAvatar} unoptimized referrerPolicy="no-referrer" />
                        ) : (
                          <span className={styles.adminAvatarFallback}>{(admin.display_name || '?')[0].toUpperCase()}</span>
                        )}
                        <span>
                          {admin.display_name || 'Unnamed'}
                          {admin.linkedEmails && admin.linkedEmails.length > 0 ? (
                            <span className={styles.sectionHint}>
                              {' · '}{admin.linkedEmails.map((e) => e.email).join(' · ')}
                            </span>
                          ) : (
                            admin.email && <span className={styles.sectionHint}> · {admin.email}</span>
                          )}
                        </span>
                      </span>
                      <span>{new Date(admin.created_at).toLocaleDateString('en-US', { timeZone: PACIFIC_TZ, month: 'short', year: 'numeric' })}</span>
                      <button
                        type="button"
                        className={styles.activityBtn}
                        onClick={() => setActivityFor({ id: admin.id, title: admin.display_name || 'Unnamed' })}
                      >
                        <Activity size={13} strokeWidth={1.5} aria-hidden="true" /> View
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
        </>
      )}

      {tab === 'audit-log' && isAdmin && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionLabel}>Audit Log</h2>
            <span className={styles.sectionHint}>Who changed what across the portal</span>
          </div>
          <AuditLogClient />
        </section>
      )}

      {tab === 'access' && isAdmin && <AccessPanel />}
      {tab === 'members' && isAdmin && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionLabel}>Member Management</h2>
            <span className={styles.sectionHint}>Search any user and change their role instantly</span>
            {roleHistoryEntries && (
              <IconButton kind="history" label="View role change history" onClick={() => setHistoryOpen(true)} />
            )}
          </div>
          <RoleManager users={allUsers} divisions={divisions} />
        </section>
      )}


      {tab === 'analytics' && <StatsClient data={statsData} />}

      {tab === 'short-links' && isAdmin && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionLabel}>Short Links</h2>
            <span className={styles.sectionHint}>Custom redirects on your own domain, like /linktree</span>
          </div>
          <LinksManager />
        </section>
      )}

      {tab === 'system' && isAdmin && <SystemStats />}

      {historyOpen && roleHistoryEntries && (
        <div className={styles.historyOverlay} onClick={() => setHistoryOpen(false)}>
          <div className={styles.historyModal} onClick={(e) => e.stopPropagation()}>
            <button type="button" className={styles.historyClose} onClick={() => setHistoryOpen(false)} aria-label="Close role history">
              <X size={18} strokeWidth={1.75} aria-hidden="true" />
            </button>
            <RoleHistoryClient entries={roleHistoryEntries} divisions={divisions} />
          </div>
        </div>
      )}

      {activityFor && (
        <div className={styles.historyOverlay} onClick={() => setActivityFor(null)}>
          <div className={styles.historyModal} onClick={(e) => e.stopPropagation()}>
            <button type="button" className={styles.historyClose} onClick={() => setActivityFor(null)} aria-label="Close activity">
              <X size={18} strokeWidth={1.75} aria-hidden="true" />
            </button>
            <h1 className={styles.title}>{activityFor.title}&apos;s Activity</h1>
            {activityError && <p className={styles.sectionHint}>{activityError}</p>}
            {activityEntries === null ? (
              <p className={styles.sectionHint}>Loading…</p>
            ) : activityEntries.length === 0 ? (
              <p className={styles.sectionHint}>Nothing tracked yet — see the activity feed&apos;s own note on what it does and doesn&apos;t cover.</p>
            ) : (
              <ul className={styles.activityList}>
                {activityEntries.map((entry, i) => (
                  <li key={i} className={styles.activityRow}>
                    <div>
                      <span className={styles.activityAction}>{entry.action}</span>
                      <span className={styles.sectionHint}> {entry.detail}</span>
                    </div>
                    <span className={styles.sectionHint}>
                      {formatPacificDateTime(entry.occurred_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

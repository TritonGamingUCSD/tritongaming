'use client';

import SectionTabs from '@/components/ui/SectionTabs';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ReactNode } from 'react';
import { Pencil, BarChart3, History, Activity, X, Server, Users as UsersIcon, ListOrdered, ScrollText, Link2, KeyRound } from 'lucide-react';
import { usePortalTabSync, useUrlNav } from '@/lib/usePortalTabSync';
import { resolveAvatarUrl } from '@/lib/profile';
import { PACIFIC_TZ, formatPacificDateTime } from '@/lib/timezone';
import RoleManager from './RoleManager';
import AccessPanel from './AccessPanel';
import BoardOrderManager from './BoardOrderManager';
import SystemStats from './SystemStats';
import StatsClient from './stats/StatsClient';
import type { StatsData } from './stats/getStatsData';
import AuditLogClient from './audit/AuditLogClient';
import LinksManager from '../links/LinksManager';
import RoleHistoryClient from './history/RoleHistoryClient';
import type { RoleChangeEntry } from './history/getRoleHistoryData';
import IconButton from '@/components/ui/IconButton';
import styles from './admin.module.css';

interface Props {
  isAdmin: boolean;
  stats: { label: string; value: number; icon: ReactNode }[];
  allUsers: Parameters<typeof RoleManager>[0]['users'];
  divisions: Parameters<typeof RoleManager>[0]['divisions'];
  statsData: StatsData;
  roleHistoryEntries?: RoleChangeEntry[];
  initialTab?: string;
}

type Tab = 'overview' | 'roles' | 'access' | 'order' | 'analytics' | 'audit' | 'links' | 'system';
const VALID_TABS: Tab[] = ['overview', 'roles', 'access', 'order', 'analytics', 'audit', 'links', 'system'];

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
  function selectTab(t: Tab) {
    setTab(t);
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
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Admin</h1>
          <p className={styles.titleSub}>Platform management</p>
        </div>
        <div className={styles.headerActions}>
          <Link href="/portal?section=site-content" className={styles.cmsBtn}>
            <Pencil size={14} strokeWidth={1.5} aria-hidden="true" /> Edit Site Content
          </Link>
        </div>
      </div>

      <SectionTabs
        value={tab}
        onChange={selectTab}
        tabs={[
          { id: 'overview', label: 'Overview' },
          ...(isAdmin ? [{ id: 'roles' as const, label: 'Member Management', icon: <UsersIcon /> }, { id: 'access' as const, label: 'Access', icon: <KeyRound /> }, { id: 'order' as const, label: 'Display Order', icon: <ListOrdered /> }] : []),
          { id: 'analytics', label: 'Analytics', icon: <BarChart3 /> },
          ...(isAdmin ? [{ id: 'audit' as const, label: 'Audit Log', icon: <ScrollText /> }, { id: 'links' as const, label: 'Short Links', icon: <Link2 /> }, { id: 'system' as const, label: 'System', icon: <Server /> }] : []),
        ]}
      />

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

      {tab === 'audit' && isAdmin && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionLabel}>Audit Log</h2>
            <span className={styles.sectionHint}>Who changed what across the portal</span>
          </div>
          <AuditLogClient />
        </section>
      )}

      {tab === 'access' && isAdmin && <AccessPanel />}
      {tab === 'roles' && isAdmin && (
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

      {tab === 'order' && isAdmin && <BoardOrderManager users={allUsers} />}

      {tab === 'analytics' && <StatsClient data={statsData} />}

      {tab === 'links' && isAdmin && (
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

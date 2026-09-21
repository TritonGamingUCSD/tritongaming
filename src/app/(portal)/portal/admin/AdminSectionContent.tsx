'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ReactNode } from 'react';
import { Pencil, BarChart3, History, X, Server, Users as UsersIcon } from 'lucide-react';
import { usePortalTabSync } from '@/lib/usePortalTabSync';
import RoleManager from './RoleManager';
import SystemStats from './SystemStats';
import StatsClient from './stats/StatsClient';
import type { StatsData } from './stats/getStatsData';
import RoleHistoryClient from './history/RoleHistoryClient';
import type { RoleChangeEntry } from './history/getRoleHistoryData';
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

type Tab = 'overview' | 'roles' | 'analytics' | 'system';
const VALID_TABS: Tab[] = ['overview', 'roles', 'analytics', 'system'];

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
export default function AdminSectionContent({ isAdmin, stats, allUsers, divisions, statsData, roleHistoryEntries, initialTab }: Props) {
  const [tab, setTab] = useState<Tab>(VALID_TABS.includes(initialTab as Tab) ? (initialTab as Tab) : 'overview');
  const syncUrl = usePortalTabSync('admin');
  function selectTab(t: Tab) {
    setTab(t);
    syncUrl(t);
  }
  const [historyOpen, setHistoryOpen] = useState(false);

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Admin</h1>
          <p className={styles.titleSub}>Platform management</p>
        </div>
        <div className={styles.headerActions}>
          <Link href="/portal?section=content" className={styles.cmsBtn}>
            <Pencil size={14} strokeWidth={1.5} aria-hidden="true" /> Edit Site Content
          </Link>
        </div>
      </div>

      <div className={styles.tabBar} role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'overview'} className={`${styles.tab} ${tab === 'overview' ? styles.tabActive : ''}`} onClick={() => selectTab('overview')}>
          Overview
        </button>
        {isAdmin && (
          <button type="button" role="tab" aria-selected={tab === 'roles'} className={`${styles.tab} ${tab === 'roles' ? styles.tabActive : ''}`} onClick={() => selectTab('roles')}>
            <UsersIcon size={13} strokeWidth={1.5} aria-hidden="true" /> Member Management
          </button>
        )}
        <button type="button" role="tab" aria-selected={tab === 'analytics'} className={`${styles.tab} ${tab === 'analytics' ? styles.tabActive : ''}`} onClick={() => selectTab('analytics')}>
          <BarChart3 size={13} strokeWidth={1.5} aria-hidden="true" /> Analytics
        </button>
        {isAdmin && (
          <button type="button" role="tab" aria-selected={tab === 'system'} className={`${styles.tab} ${tab === 'system' ? styles.tabActive : ''}`} onClick={() => selectTab('system')}>
            <Server size={13} strokeWidth={1.5} aria-hidden="true" /> System
          </button>
        )}
      </div>

      {tab === 'overview' && (
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
      )}

      {tab === 'roles' && isAdmin && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionLabel}>Member Management</h2>
            <span className={styles.sectionHint}>Search any user and change their role instantly</span>
            {roleHistoryEntries && (
              <button type="button" className={styles.historyIconBtn} onClick={() => setHistoryOpen(true)} aria-label="View role change history">
                <History size={15} strokeWidth={1.5} aria-hidden="true" />
              </button>
            )}
          </div>
          <RoleManager users={allUsers} divisions={divisions} />
        </section>
      )}

      {tab === 'analytics' && <StatsClient data={statsData} />}

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
    </div>
  );
}

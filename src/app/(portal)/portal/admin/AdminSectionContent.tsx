'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ReactNode } from 'react';
import { Pencil, BarChart3, History } from 'lucide-react';
import RoleManager from './RoleManager';
import StorageCleanup from './StorageCleanup';
import StatsClient from './stats/StatsClient';
import type { StatsData } from './stats/getStatsData';
import RoleHistoryClient from './history/RoleHistoryClient';
import type { RoleChangeEntry } from './history/getRoleHistoryData';
import styles from './admin.module.css';

interface Props {
  isAdmin: boolean;
  stats: { label: string; value: number; icon: ReactNode }[];
  eventTicketStats: { id: string; title: string; issued: number; checkedIn: number }[];
  allUsers: Parameters<typeof RoleManager>[0]['users'];
  divisions: Parameters<typeof RoleManager>[0]['divisions'];
  statsData: StatsData;
  roleHistoryEntries?: RoleChangeEntry[];
}

type Tab = 'overview' | 'analytics' | 'role-history';

// Analytics and Role History used to be their own top-level hub cards
// alongside this one — all three are the same "admin" audience and none of
// them stand alone the way, say, Events or Members do, so three separate
// cards just added to the pile without actually helping anyone find
// anything. Tabs within one Admin card instead: same destinations, one
// entry point.
export default function AdminSectionContent({ isAdmin, stats, eventTicketStats, allUsers, divisions, statsData, roleHistoryEntries }: Props) {
  const [tab, setTab] = useState<Tab>('overview');

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Admin</h1>
          <p className={styles.titleSub}>Platform management</p>
        </div>
        <div className={styles.headerActions}>
          <Link href="/portal?open=content" className={styles.cmsBtn}>
            <Pencil size={14} strokeWidth={1.5} aria-hidden="true" /> Edit Site Content
          </Link>
        </div>
      </div>

      <div className={styles.tabBar} role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'overview'} className={`${styles.tab} ${tab === 'overview' ? styles.tabActive : ''}`} onClick={() => setTab('overview')}>
          Overview
        </button>
        <button type="button" role="tab" aria-selected={tab === 'analytics'} className={`${styles.tab} ${tab === 'analytics' ? styles.tabActive : ''}`} onClick={() => setTab('analytics')}>
          <BarChart3 size={13} strokeWidth={1.5} aria-hidden="true" /> Analytics
        </button>
        {isAdmin && roleHistoryEntries && (
          <button type="button" role="tab" aria-selected={tab === 'role-history'} className={`${styles.tab} ${tab === 'role-history' ? styles.tabActive : ''}`} onClick={() => setTab('role-history')}>
            <History size={13} strokeWidth={1.5} aria-hidden="true" /> Role History
          </button>
        )}
      </div>

      {tab === 'overview' && (
        <>
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

          {isAdmin && <StorageCleanup />}
        </>
      )}

      {tab === 'analytics' && <StatsClient data={statsData} />}

      {tab === 'role-history' && roleHistoryEntries && (
        <RoleHistoryClient entries={roleHistoryEntries} divisions={divisions} />
      )}
    </div>
  );
}

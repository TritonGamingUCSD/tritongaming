'use client';

import Notice from '@/components/ui/Notice';
import { useEffect, useState } from 'react';
import { Database, HardDrive, Triangle, ExternalLink, Users, Server, ShieldCheck, Trash2 } from 'lucide-react';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import adminStyles from './admin.module.css';
import styles from './SystemStats.module.css';

interface TableStat {
  name: string;
  row_estimate: number;
  total_bytes: number;
  table_bytes: number;
}

interface BucketStat {
  bucket: string;
  objectCount: number;
  totalBytes: number;
}

interface VercelDeployment {
  uid: string;
  url: string;
  state: string;
  target: string | null;
  createdAt: number;
}

interface VercelStats {
  connected: boolean;
  error?: string;
  name?: string;
  framework?: string | null;
  productionUrl?: string;
  deployments?: VercelDeployment[];
}

interface AccountStats {
  total_accounts: number;
  multi_identity_accounts: number;
  no_role_accounts: number;
  signups_last_30d: number;
}

interface EnvironmentInfo {
  nodeVersion: string;
  gitCommitSha?: string;
  gitCommitRef?: string;
  vercelEnv?: string;
}

interface SystemStatsResponse {
  database: {
    totalBytes: number; tables: TableStat[]; postgresVersion?: string;
    activeConnections?: number; rlsEnabledTables?: number; totalTables?: number;
  } | null;
  accounts: AccountStats | null;
  storage: BucketStat[];
  vercel: VercelStats;
  environment: EnvironmentInfo;
}

const BUCKET_LABELS: Record<string, string> = {
  'event-flyers': 'Event Flyers',
  'division-logos': 'Division Logos',
  avatars: 'Profile Pictures',
  'site-content': 'Site Content',
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function timeAgo(ms: number): string {
  const mins = Math.round((Date.now() - ms) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

const DEPLOY_STATE_CLASS: Record<string, string> = {
  READY: styles.stateReady,
  ERROR: styles.stateError,
  BUILDING: styles.stateBuilding,
  QUEUED: styles.stateBuilding,
  CANCELED: styles.stateCanceled,
};

export default function SystemStats() {
  const [data, setData] = useState<SystemStatsResponse | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/system-stats');
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(json.error || 'Failed to load system stats.');
          return;
        }
        setData(json);
      } catch {
        if (!cancelled) setError('Network error loading system stats.');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (error) {
    return <Notice tone="error">{error}</Notice>;
  }

  if (!data) {
    return <LoadingSpinner size={28} label="Loading system stats…" theme="auto" />;
  }

  const totalStorageBytes = data.storage.reduce((sum, b) => sum + b.totalBytes, 0);

  return (
    <div className={styles.wrap}>
      <div className={adminStyles.statsGrid} aria-label="System at a glance">
        <div className={adminStyles.statCard}>
          <span className={adminStyles.statIcon}><Database size={22} strokeWidth={1.5} aria-hidden="true" /></span>
          <div><div className={adminStyles.statValue}>{data.database ? formatBytes(data.database.totalBytes) : '—'}</div><div className={adminStyles.statLabel}>Database</div></div>
        </div>
        <div className={adminStyles.statCard}>
          <span className={adminStyles.statIcon}><HardDrive size={22} strokeWidth={1.5} aria-hidden="true" /></span>
          <div><div className={adminStyles.statValue}>{formatBytes(totalStorageBytes)}</div><div className={adminStyles.statLabel}>File storage</div></div>
        </div>
        <div className={adminStyles.statCard}>
          <span className={adminStyles.statIcon}><Server size={22} strokeWidth={1.5} aria-hidden="true" /></span>
          <div><div className={adminStyles.statValue}>{data.database?.activeConnections ?? '—'}</div><div className={adminStyles.statLabel}>Active connections</div></div>
        </div>
        <div className={adminStyles.statCard}>
          <span className={adminStyles.statIcon}><Triangle size={20} strokeWidth={1.75} aria-hidden="true" /></span>
          <div><div className={adminStyles.statValue}>{data.vercel.connected && data.vercel.deployments?.[0] ? data.vercel.deployments[0].state.toLowerCase() : '—'}</div><div className={adminStyles.statLabel}>Latest deploy</div></div>
        </div>
      </div>

      <h2 className={styles.groupTitle}>Usage</h2>
      <section className={adminStyles.section}>
        <div className={adminStyles.sectionHeader}>
          <h2 className={adminStyles.sectionLabel}><Database size={13} strokeWidth={1.75} aria-hidden="true" /> Database</h2>
          {data.database && (
            <span className={adminStyles.sectionHint}>
              {formatBytes(data.database.totalBytes)} total
              {data.database.activeConnections !== undefined && ` · ${data.database.activeConnections} active connections`}
              {data.database.rlsEnabledTables !== undefined && data.database.totalTables !== undefined &&
                ` · RLS on ${data.database.rlsEnabledTables}/${data.database.totalTables} tables`}
            </span>
          )}
        </div>
        {!data.database ? (
          <p className={styles.empty}>Database stats unavailable.</p>
        ) : (
          <div className={styles.tableList}>
            {data.database.tables.map((t) => {
              const pct = data.database!.totalBytes > 0 ? (t.total_bytes / data.database!.totalBytes) * 100 : 0;
              return (
                <div key={t.name} className={styles.tableRow}>
                  <span className={styles.tableName}>{t.name}</span>
                  <div className={styles.tableBar}>
                    <div className={styles.tableBarFill} style={{ width: `${Math.max(pct, 1.5)}%` }} />
                  </div>
                  <span className={styles.tableMeta}>{t.row_estimate.toLocaleString()} rows</span>
                  <span className={styles.tableSize}>{formatBytes(t.total_bytes)}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className={adminStyles.section}>
        <div className={adminStyles.sectionHeader}>
          <h2 className={adminStyles.sectionLabel}><HardDrive size={13} strokeWidth={1.75} aria-hidden="true" /> Storage Buckets</h2>
          <span className={adminStyles.sectionHint}>{formatBytes(totalStorageBytes)} across all buckets</span>
        </div>

        <div className={styles.bucketGrid}>
          {data.storage.map((b) => {
            return (
              <div key={b.bucket} className={styles.bucketCard}>
                <span className={styles.bucketName}>{BUCKET_LABELS[b.bucket] ?? b.bucket}</span>
                <span className={styles.bucketSize}>{formatBytes(b.totalBytes)}</span>
                <span className={styles.bucketCount}>{b.objectCount.toLocaleString()} file{b.objectCount === 1 ? '' : 's'}</span>
              </div>
            );
          })}
        </div>

      </section>

      <section className={adminStyles.section}>
        <div className={adminStyles.sectionHeader}>
          <h2 className={adminStyles.sectionLabel}><Trash2 size={13} strokeWidth={1.75} aria-hidden="true" /> Automatic tidy-up</h2>
        </div>
        <p className={styles.empty}>Storage looks after itself. Pictures are compressed as they are uploaded, a replaced or removed picture is deleted right away, and every Sunday the site deletes any file nothing links to any more (once it is a day old) and compresses older pictures. There is nothing to run by hand.</p>
      </section>

      <h2 className={styles.groupTitle}>Platform</h2>
      {data.accounts && (
        <section className={adminStyles.section}>
          <div className={adminStyles.sectionHeader}>
            <h2 className={adminStyles.sectionLabel}><Users size={13} strokeWidth={1.75} aria-hidden="true" /> Accounts</h2>
          </div>
          <div className={adminStyles.statsGrid}>
            <div className={adminStyles.statCard}>
              <span className={adminStyles.statIcon}><Users size={22} strokeWidth={1.5} aria-hidden="true" /></span>
              <div>
                <div className={adminStyles.statValue}>{data.accounts.total_accounts.toLocaleString()}</div>
                <div className={adminStyles.statLabel}>Total Accounts</div>
              </div>
            </div>
            <div className={adminStyles.statCard}>
              <span className={adminStyles.statIcon}><Users size={22} strokeWidth={1.5} aria-hidden="true" /></span>
              <div>
                <div className={adminStyles.statValue}>{data.accounts.signups_last_30d.toLocaleString()}</div>
                <div className={adminStyles.statLabel}>Signups (30d)</div>
              </div>
            </div>
            <div className={adminStyles.statCard}>
              <span className={adminStyles.statIcon}><ShieldCheck size={22} strokeWidth={1.5} aria-hidden="true" /></span>
              <div>
                <div className={adminStyles.statValue}>{data.accounts.multi_identity_accounts.toLocaleString()}</div>
                <div className={adminStyles.statLabel}>Have a Backup Google Linked</div>
              </div>
            </div>
            <div className={adminStyles.statCard}>
              <span className={adminStyles.statIcon}><Users size={22} strokeWidth={1.5} aria-hidden="true" /></span>
              <div>
                <div className={adminStyles.statValue}>{data.accounts.no_role_accounts.toLocaleString()}</div>
                <div className={adminStyles.statLabel}>No Role Assigned</div>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className={adminStyles.section}>
        <div className={adminStyles.sectionHeader}>
          <h2 className={adminStyles.sectionLabel}><Server size={13} strokeWidth={1.75} aria-hidden="true" /> Environment</h2>
        </div>
        <div className={adminStyles.statsGrid}>
          <div className={adminStyles.statCard}>
            <span className={adminStyles.statIcon}><Server size={22} strokeWidth={1.5} aria-hidden="true" /></span>
            <div>
              <div className={styles.envValue}>{data.environment.vercelEnv ?? 'local'}</div>
              <div className={adminStyles.statLabel}>Environment</div>
            </div>
          </div>
          <div className={adminStyles.statCard}>
            <span className={adminStyles.statIcon}><Server size={22} strokeWidth={1.5} aria-hidden="true" /></span>
            <div>
              <div className={styles.envValue}>{data.environment.gitCommitSha ?? '—'}</div>
              <div className={adminStyles.statLabel}>{data.environment.gitCommitRef ?? 'Commit'}</div>
            </div>
          </div>
          <div className={adminStyles.statCard}>
            <span className={adminStyles.statIcon}><Server size={22} strokeWidth={1.5} aria-hidden="true" /></span>
            <div>
              <div className={styles.envValue}>{data.environment.nodeVersion}</div>
              <div className={adminStyles.statLabel}>Node</div>
            </div>
          </div>
          {data.database?.postgresVersion && (
            <div className={adminStyles.statCard}>
              <span className={adminStyles.statIcon}><Database size={22} strokeWidth={1.5} aria-hidden="true" /></span>
              <div>
                <div className={styles.envValue}>{data.database.postgresVersion.replace('PostgreSQL ', '')}</div>
                <div className={adminStyles.statLabel}>Postgres</div>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className={adminStyles.section}>
        <div className={adminStyles.sectionHeader}>
          <h2 className={adminStyles.sectionLabel}><Triangle size={11} strokeWidth={2} aria-hidden="true" /> Vercel</h2>
        </div>
        {!data.vercel.connected ? (
          <p className={styles.empty}>
            Not connected — set <code className={styles.code}>VERCEL_API_TOKEN</code> and <code className={styles.code}>VERCEL_PROJECT_ID</code> (and
            optionally <code className={styles.code}>VERCEL_TEAM_ID</code>) to show deployment status here.
          </p>
        ) : data.vercel.error ? (
          <Notice tone="error">{data.vercel.error}</Notice>
        ) : (
          <div className={styles.vercelCard}>
            <div className={styles.vercelHeader}>
              <div>
                <span className={styles.vercelName}>{data.vercel.name}</span>
                {data.vercel.framework && <span className={styles.vercelFramework}>{data.vercel.framework}</span>}
              </div>
              {data.vercel.productionUrl && (
                <a href={`https://${data.vercel.productionUrl}`} target="_blank" rel="noopener noreferrer" className={styles.vercelLink}>
                  {data.vercel.productionUrl} <ExternalLink size={12} strokeWidth={1.75} aria-hidden="true" />
                </a>
              )}
            </div>
            {data.vercel.deployments && data.vercel.deployments.length > 0 && (
              <ul className={styles.deployList}>
                {data.vercel.deployments.map((d) => (
                  <li key={d.uid} className={styles.deployRow}>
                    <span className={`${styles.deployState} ${DEPLOY_STATE_CLASS[d.state] ?? ''}`}>{d.state.toLowerCase()}</span>
                    <span className={styles.deployTarget}>{d.target ?? 'preview'}</span>
                    <span className={styles.deployTime}>{timeAgo(d.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

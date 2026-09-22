'use client';

import { useEffect, useState } from 'react';
import { Database, HardDrive, Triangle, ExternalLink, Users, Server, ShieldCheck } from 'lucide-react';
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

interface BucketPreview {
  bucket: string;
  totalObjects: number;
  unusedCount: number;
  unusedBytes: number;
}

interface BucketResult {
  bucket: string;
  deletedCount: number;
  deletedBytes: number;
  error?: string;
}

const BUCKET_LABELS: Record<string, string> = {
  'event-flyers': 'Event Flyers',
  'division-logos': 'Division Logos',
  avatars: 'Profile Pictures',
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

  // Unused-file scan/delete — was its own separate StorageCleanup card
  // sitting right below this one with its own near-identical per-bucket
  // list, which just meant "how much am I using" and "what can I clean up"
  // were two things to reconcile in your head instead of one bucket grid
  // with both answers on it.
  const [preview, setPreview] = useState<BucketPreview[] | null>(null);
  const [cleanupResult, setCleanupResult] = useState<BucketResult[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [cleanupError, setCleanupError] = useState('');

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

  async function handleScan() {
    setScanning(true);
    setCleanupError('');
    setCleanupResult(null);
    try {
      const res = await fetch('/api/admin/storage-cleanup');
      const json = await res.json();
      if (!res.ok) {
        setCleanupError(json.error || 'Scan failed.');
        return;
      }
      setPreview(json.buckets);
    } catch {
      setCleanupError('Network error. Please try again.');
    } finally {
      setScanning(false);
    }
  }

  async function handleDelete() {
    const totalUnused = preview?.reduce((sum, b) => sum + b.unusedCount, 0) ?? 0;
    if (!window.confirm(`Delete ${totalUnused} unused file${totalUnused === 1 ? '' : 's'}? This can't be undone.`)) return;

    setDeleting(true);
    setCleanupError('');
    try {
      const res = await fetch('/api/admin/storage-cleanup', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) {
        setCleanupError(json.error || 'Cleanup failed.');
        return;
      }
      setCleanupResult(json.buckets);
      setPreview(null);
      // The scan that just ran deleted real objects — the totals fetched on
      // mount are now stale, so pull fresh ones rather than let the bucket
      // cards keep showing pre-cleanup sizes.
      const refreshed = await fetch('/api/admin/system-stats');
      if (refreshed.ok) setData(await refreshed.json());
    } catch {
      setCleanupError('Network error. Please try again.');
    } finally {
      setDeleting(false);
    }
  }

  if (error) {
    return <p className={styles.error}>{error}</p>;
  }

  if (!data) {
    return <LoadingSpinner size={28} label="Loading system stats…" theme="dark" />;
  }

  const totalStorageBytes = data.storage.reduce((sum, b) => sum + b.totalBytes, 0);
  const previewByBucket = new Map((preview ?? []).map((p) => [p.bucket, p]));
  const totalUnused = preview?.reduce((sum, b) => sum + b.unusedCount, 0) ?? 0;
  const totalDeleted = cleanupResult?.reduce((sum, b) => sum + b.deletedCount, 0) ?? 0;
  const totalDeletedBytes = cleanupResult?.reduce((sum, b) => sum + b.deletedBytes, 0) ?? 0;

  return (
    <div className={styles.wrap}>
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
            const bucketPreview = previewByBucket.get(b.bucket);
            return (
              <div key={b.bucket} className={styles.bucketCard}>
                <span className={styles.bucketName}>{BUCKET_LABELS[b.bucket] ?? b.bucket}</span>
                <span className={styles.bucketSize}>{formatBytes(b.totalBytes)}</span>
                <span className={styles.bucketCount}>{b.objectCount.toLocaleString()} file{b.objectCount === 1 ? '' : 's'}</span>
                {bucketPreview && (
                  <span className={bucketPreview.unusedCount > 0 ? styles.bucketUnused : styles.bucketClean}>
                    {bucketPreview.unusedCount > 0
                      ? `${bucketPreview.unusedCount} unused (${formatBytes(bucketPreview.unusedBytes)})`
                      : 'All in use'}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div className={styles.cleanupControls}>
          <button type="button" className={styles.scanBtn} onClick={handleScan} disabled={scanning || deleting}>
            {scanning ? 'Scanning…' : 'Scan for Unused Files'}
          </button>
          {preview && totalUnused > 0 && (
            <button type="button" className={styles.deleteBtn} onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : `Delete ${totalUnused} Unused File${totalUnused === 1 ? '' : 's'}`}
            </button>
          )}
        </div>

        {cleanupError && <p className={styles.error}>{cleanupError}</p>}

        {cleanupResult && (
          <p className={styles.successNote}>
            Deleted {totalDeleted} file{totalDeleted === 1 ? '' : 's'}
            {totalDeletedBytes > 0 ? ` (${formatBytes(totalDeletedBytes)} freed)` : ''}.
          </p>
        )}
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
          <p className={styles.error}>{data.vercel.error}</p>
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

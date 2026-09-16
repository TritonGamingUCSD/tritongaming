'use client';

import { useState } from 'react';
import adminStyles from './admin.module.css';
import styles from './StorageCleanup.module.css';

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
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Admin-triggered sweep for orphaned uploads — files left behind by a
// Replace/Remove or an abandoned edit (see deleteIfReplaced in
// src/lib/imageUpload.ts for the incremental cleanup this backstops).
// Scan first shows what would go; Delete re-checks server-side and removes it.
export default function StorageCleanup() {
  const [preview, setPreview] = useState<BucketPreview[] | null>(null);
  const [result, setResult] = useState<BucketResult[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  async function handleScan() {
    setScanning(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch('/api/admin/storage-cleanup');
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Scan failed.');
        return;
      }
      setPreview(data.buckets);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setScanning(false);
    }
  }

  async function handleDelete() {
    const totalUnused = preview?.reduce((sum, b) => sum + b.unusedCount, 0) ?? 0;
    if (!window.confirm(`Delete ${totalUnused} unused file${totalUnused === 1 ? '' : 's'}? This can't be undone.`)) return;

    setDeleting(true);
    setError('');
    try {
      const res = await fetch('/api/admin/storage-cleanup', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Cleanup failed.');
        return;
      }
      setResult(data.buckets);
      setPreview(null);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setDeleting(false);
    }
  }

  const totalUnused = preview?.reduce((sum, b) => sum + b.unusedCount, 0) ?? 0;
  const totalDeleted = result?.reduce((sum, b) => sum + b.deletedCount, 0) ?? 0;
  const totalDeletedBytes = result?.reduce((sum, b) => sum + b.deletedBytes, 0) ?? 0;

  return (
    <section className={adminStyles.section}>
      <div className={adminStyles.sectionHeader}>
        <h2 className={adminStyles.sectionLabel}>Storage Cleanup</h2>
        <span className={adminStyles.sectionHint}>
          Finds uploaded flyers, logos, and profile pictures no longer used anywhere
        </span>
      </div>

      <div className={styles.controls}>
        <button type="button" className={styles.scanBtn} onClick={handleScan} disabled={scanning || deleting}>
          {scanning ? 'Scanning…' : 'Scan for Unused Files'}
        </button>
        {preview && totalUnused > 0 && (
          <button type="button" className={styles.deleteBtn} onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Deleting…' : `Delete ${totalUnused} Unused File${totalUnused === 1 ? '' : 's'}`}
          </button>
        )}
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {preview && (
        <div className={styles.table}>
          {preview.map((b) => (
            <div key={b.bucket} className={styles.row}>
              <span className={styles.bucketName}>{BUCKET_LABELS[b.bucket] ?? b.bucket}</span>
              <span className={styles.detail}>{b.totalObjects} total</span>
              <span className={b.unusedCount > 0 ? styles.unused : styles.clean}>
                {b.unusedCount > 0 ? `${b.unusedCount} unused (${formatBytes(b.unusedBytes)})` : 'All in use'}
              </span>
            </div>
          ))}
        </div>
      )}

      {result && (
        <p className={styles.successNote}>
          Deleted {totalDeleted} file{totalDeleted === 1 ? '' : 's'}
          {totalDeletedBytes > 0 ? ` (${formatBytes(totalDeletedBytes)} freed)` : ''}.
        </p>
      )}
    </section>
  );
}

'use client';

import Loading from '@/components/Loading/Loading';
import { useEffect, useState } from 'react';
import { History, X } from 'lucide-react';
import { dayTime, docsGet } from './docsApi';
import styles from './docs.module.css';

export interface Version { id: string; title: string; content: string; created_at: string; note: string | null; by: string }

// The published versions of a doc, newest first, and which one is being looked at. The edit page shows the chosen version in the main area (see VersionCompare).
export function useVersions(docId: string, enabled: boolean) {
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    void docsGet<{ versions: Version[] }>(`/api/docs/versions?id=${docId}`).then((r) => {
      if (!live) return;
      if (r.ok) { setVersions(r.json.versions); setOpen((cur) => cur ?? r.json.versions[0]?.id ?? null); } else setError(r.json.error || 'Couldn’t load the history.');
    });
    return () => { live = false; };
  }, [docId, enabled]);
  const index = versions ? versions.findIndex((v) => v.id === open) : -1;
  return { versions, error, open, setOpen, current: index >= 0 ? versions![index] : null, previous: index >= 0 ? versions![index + 1] ?? null : null };
}

export default function VersionHistory({ versions, error, open, onOpen, onClose }: { versions: Version[] | null; error: string; open: string | null; onOpen: (id: string) => void; onClose: () => void }) {
  return (
    <aside className={styles.history} aria-label="Version history">
      <header className={styles.historyHead}>
        <h2><History size={16} aria-hidden="true" /> Version History</h2>
        <button type="button" className={styles.iconBtn} onClick={onClose} aria-label="Close history"><X size={16} aria-hidden="true" /></button>
      </header>
      {error && <p className={styles.errorText}>{error}</p>}
      {!versions && !error && <Loading variant="inline" label="Loading…" />}
      {versions && versions.length === 0 && <p className={styles.muted}>Nothing published yet.</p>}
      {versions && versions.length > 0 && (
        <ol className={styles.versionList}>
          {versions.map((v, i) => (
            <li key={v.id}>
              <button type="button" className={`${styles.versionRow} ${v.id === open ? styles.versionOn : ''}`} onClick={() => onOpen(v.id)} aria-current={v.id === open ? 'true' : undefined}>
                <strong>{dayTime(v.created_at)}{i === 0 && <em className={styles.liveTag}>live</em>}</strong>
                <span>{v.by}{v.note ? ` · ${v.note}` : ''}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}

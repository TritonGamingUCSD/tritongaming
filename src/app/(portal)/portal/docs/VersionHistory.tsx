'use client';

import { useEffect, useState } from 'react';
import { History, RotateCcw, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import MarkdownContent from '@/components/MarkdownContent/MarkdownContent';
import { dayTime, docsGet } from './docsApi';
import styles from './docs.module.css';

interface Version { id: string; title: string; content: string; created_at: string; note: string | null; by: string }

// Past published versions of a doc: look at one, and bring it back as the draft (it only goes live when published again).
export default function VersionHistory({ docId, onRestore, onClose }: { docId: string; onRestore: (v: Version) => void; onClose: () => void }) {
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void docsGet<{ versions: Version[] }>(`/api/docs/versions?id=${docId}`).then((r) => {
      if (!live) return;
      if (r.ok) { setVersions(r.json.versions); setOpen(r.json.versions[0]?.id ?? null); } else setError(r.json.error || 'Couldn’t load the history.');
    });
    return () => { live = false; };
  }, [docId]);
  const shown = versions?.find((v) => v.id === open) ?? null;
  return (
    <aside className={styles.history} aria-label="Version history">
      <header className={styles.historyHead}>
        <h2><History size={16} aria-hidden="true" /> Version History</h2>
        <button type="button" className={styles.iconBtn} onClick={onClose} aria-label="Close history"><X size={16} aria-hidden="true" /></button>
      </header>
      {error && <p className={styles.errorText}>{error}</p>}
      {!versions && !error && <LoadingSpinner size={22} label="Loading…" theme="auto" />}
      {versions && versions.length === 0 && <p className={styles.muted}>Nothing published yet.</p>}
      {versions && versions.length > 0 && (
        <div className={styles.historyBody}>
          <ol className={styles.versionList}>
            {versions.map((v, i) => (
              <li key={v.id}>
                <button type="button" className={`${styles.versionRow} ${v.id === open ? styles.versionOn : ''}`} onClick={() => setOpen(v.id)}>
                  <strong>{dayTime(v.created_at)}{i === 0 && <em className={styles.liveTag}>live</em>}</strong>
                  <span>{v.by}{v.note ? ` · ${v.note}` : ''}</span>
                </button>
              </li>
            ))}
          </ol>
          {shown && (
            <div className={styles.versionView}>
              <div className={styles.versionActions}>
                <strong>{shown.title}</strong>
                <Button size="sm" variant="secondary" onClick={() => onRestore(shown)}><RotateCcw size={14} aria-hidden="true" /> Restore As Draft</Button>
              </div>
              <div className={styles.versionText}><MarkdownContent>{shown.content || '*Empty*'}</MarkdownContent></div>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}

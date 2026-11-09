'use client';

import { useCallback, useEffect, useState } from 'react';
import { History, Save } from 'lucide-react';
import Dialog from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import { showToast } from '@/lib/ui/toast';
import { formatPacificDateTime } from '@/lib/core/timezone';
import styles from './ContentEditor.module.css';

type Info = { draft: { content: Record<string, unknown>; at: string; by: string } | null; versions: { id: string; at: string; by: string }[] };

// Drafts and history for one Site Content block. "Save Draft" keeps the edits on the server without showing them to visitors; "Load Draft" brings them back. "History" lists what was published (the latest 30) and "Restore" puts an old
// version into the form. Nothing here publishes: the editor's Publish does that (and then the draft is gone and the new version is in the history).
export default function ContentHistory({ blockKey, content, onLoad }: { blockKey: string; content: Record<string, unknown>; onLoad: (c: Record<string, unknown>) => void }) {
  const q = `key=${encodeURIComponent(blockKey)}`;
  const [info, setInfo] = useState<Info | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const r = await fetch(`/api/admin/content/history?${q}`, { cache: 'no-store' }).catch(() => null);
    if (r?.ok) setInfo(await r.json());
  }, [q]);
  useEffect(() => {
    void load();
  }, [load]);

  async function saveDraft() {
    setBusy(true);
    const r = await fetch('/api/admin/content/history', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: blockKey, content }) }).catch(
      () => null,
    );
    setBusy(false);
    if (r?.ok) {
      showToast('Draft saved. Visitors do not see it until you publish.');
      void load();
    } else showToast('Could not save the draft.', { tone: 'warn' });
  }
  async function discard() {
    setBusy(true);
    await fetch(`/api/admin/content/history?${q}`, { method: 'DELETE' }).catch(() => null);
    setBusy(false);
    void load();
  }
  async function restore(id: string) {
    setBusy(true);
    const r = await fetch(`/api/admin/content/history/${id}?${q}`, { cache: 'no-store' }).catch(() => null);
    setBusy(false);
    if (!r?.ok) return showToast('Could not load that version.', { tone: 'warn' });
    onLoad((await r.json()).content);
    setOpen(false);
    showToast('Loaded into the form. Publish to put it on the site.');
  }

  return (
    <div className={styles.histBar} onClick={(e) => e.stopPropagation()}>
      {info?.draft && (
        <div className={styles.histDraft} role="status">
          <span>
            Draft saved {formatPacificDateTime(info.draft.at)} by {info.draft.by}. Visitors do not see it.
          </span>
          <Button size="sm" variant="secondary" onClick={() => onLoad(info.draft!.content)}>
            Load Draft
          </Button>
          <Button size="sm" variant="ghost" onClick={discard} disabled={busy}>
            Discard Draft
          </Button>
        </div>
      )}
      <div className={styles.histBtns}>
        <button type="button" className={styles.histBtn} onClick={saveDraft} disabled={busy}>
          <Save size={14} aria-hidden="true" /> Save Draft
        </button>
        <button type="button" className={styles.histBtn} onClick={() => setOpen(true)}>
          <History size={14} aria-hidden="true" /> History{info && info.versions.length ? ` (${info.versions.length})` : ''}
        </button>
      </div>
      {open && (
        <Dialog title="History" onClose={() => setOpen(false)} wide>
          {info && info.versions.length === 0 ? (
            <p>Nothing published here yet. Each time you publish a change to this section, that version is kept (the latest 30).</p>
          ) : (
            <ul className={styles.histList}>
              {(info?.versions ?? []).map((v, n) => (
                <li key={v.id}>
                  <span>
                    <b>{formatPacificDateTime(v.at)}</b>
                    <small>
                      {v.by}
                      {n === 0 ? ' · what visitors see now' : ''}
                    </small>
                  </span>
                  <Button size="sm" variant="secondary" onClick={() => restore(v.id)} disabled={busy}>
                    Restore
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Dialog>
      )}
    </div>
  );
}

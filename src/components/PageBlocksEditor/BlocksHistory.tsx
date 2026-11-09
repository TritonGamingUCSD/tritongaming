'use client';

import { useCallback, useEffect, useState } from 'react';
import { History, Save } from 'lucide-react';
import Dialog from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import { showToast } from '@/lib/ui/toast';
import { formatPacificDateTime } from '@/lib/core/timezone';
import type { PageBlock } from '@/lib/site/pageBlocks';
import styles from './PageBlocksEditor.module.css';

type Info = { draft: { blocks: PageBlock[]; at: string; by: string } | null; versions: { id: string; at: string; by: string; count: number }[] };
export type PageRef = { type: 'event' | 'division'; id: string };

// Drafts and history for a page's blocks. "Save Draft" keeps the work on the server without showing it to visitors; "Load Draft" brings it back. "History" lists what was published before; "Restore" puts an old version into the editor.
// Nothing here publishes: the page's own Save does that (and then the draft is gone and the new version is in the history).
export default function BlocksHistory({ page, blocks, onLoad }: { page: PageRef; blocks: PageBlock[]; onLoad: (b: PageBlock[]) => void }) {
  const q = `type=${page.type}&id=${page.id}`;
  const [info, setInfo] = useState<Info | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const r = await fetch(`/api/page-blocks?${q}`, { cache: 'no-store' }).catch(() => null);
    if (r?.ok) setInfo(await r.json());
  }, [q]);
  useEffect(() => {
    void load();
  }, [load]);

  async function saveDraft() {
    setBusy(true);
    const r = await fetch('/api/page-blocks', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...page, blocks }) }).catch(() => null);
    setBusy(false);
    if (r?.ok) {
      showToast('Draft saved. Visitors do not see it until you save the page.');
      void load();
    } else showToast('Could not save the draft.', { tone: 'warn' });
  }
  async function discard() {
    setBusy(true);
    await fetch(`/api/page-blocks?${q}`, { method: 'DELETE' }).catch(() => null);
    setBusy(false);
    void load();
  }
  async function restore(id: string) {
    setBusy(true);
    const r = await fetch(`/api/page-blocks/versions/${id}?${q}`, { cache: 'no-store' }).catch(() => null);
    setBusy(false);
    if (!r?.ok) return showToast('Could not load that version.', { tone: 'warn' });
    onLoad((await r.json()).blocks);
    setOpen(false);
    showToast('Loaded into the editor. Save the page to publish it.');
  }

  return (
    <>
      {info?.draft && (
        <div className={styles.draftBanner} role="status">
          <span>
            You have a draft saved {formatPacificDateTime(info.draft.at)} by {info.draft.by}. Visitors do not see it.
          </span>
          <Button size="sm" variant="secondary" onClick={() => onLoad(info.draft!.blocks)}>
            Load Draft
          </Button>
          <Button size="sm" variant="ghost" onClick={discard} disabled={busy}>
            Discard Draft
          </Button>
        </div>
      )}
      <div className={styles.toolbar}>
        <button type="button" className={styles.tool} onClick={saveDraft} disabled={busy}>
          <Save size={14} aria-hidden="true" /> Save Draft
        </button>
        <button type="button" className={styles.tool} onClick={() => setOpen(true)}>
          <History size={14} aria-hidden="true" /> History{info && info.versions.length ? ` (${info.versions.length})` : ''}
        </button>
      </div>
      {open && (
        <Dialog title="Page History" onClose={() => setOpen(false)} wide>
          {info && info.versions.length === 0 ? (
            <p>Nothing published yet. Each time you save the page with changed blocks, that version is kept here (the latest 40).</p>
          ) : (
            <ul className={styles.versions}>
              {(info?.versions ?? []).map((v, n) => (
                <li key={v.id}>
                  <span>
                    <b>{formatPacificDateTime(v.at)}</b>
                    <small>
                      {v.by} · {v.count} {v.count === 1 ? 'block' : 'blocks'}
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
    </>
  );
}

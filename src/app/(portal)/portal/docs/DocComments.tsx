'use client';

import { useCallback, useEffect, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import { Textarea } from '@/components/ui/Field';
import { formatPacificDateTime } from '@/lib/core/timezone';
import styles from './docs.module.css';

interface Comment { id: string; body: string; created_at: string; resolved: boolean; author: string; mine: boolean }

// A quiet thread under the doc, closed until opened: questions and notes from the people reading it. Editors can resolve one; the writer can delete theirs.
export default function DocComments({ docId }: { docId: string }) {
  const [list, setList] = useState<Comment[] | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/docs/comments?doc_id=${docId}`);
      const j = await r.json();
      if (r.ok) { setList(j.comments); setCanEdit(j.canEdit); }
    } catch { /* leave as is */ }
  }, [docId]);
  useEffect(() => { setList(null); setText(''); setErr(''); void load(); }, [load]);

  async function call(url: string, init: RequestInit) {
    setErr('');
    try {
      const r = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json' } });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(j.error || 'Couldn’t save that.'); return false; }
      await load(); return true;
    } catch { setErr('Couldn’t reach the server. Check your connection and try again.'); return false; }
  }
  async function send() {
    setBusy(true);
    if (await call('/api/docs/comments', { method: 'POST', body: JSON.stringify({ doc_id: docId, body: text }) })) setText('');
    setBusy(false);
  }
  const open = (list ?? []).filter((c) => !c.resolved).length;
  return (
    <details className={styles.comments}>
      <summary><MessageSquare size={14} aria-hidden="true" /> Comments{list ? ` (${list.length})` : ''}{open > 0 && <span className={styles.catCount}>{open} open</span>}</summary>
      {list && list.length > 0 && (
        <ul className={styles.commentList}>
          {list.map((c) => (
            <li key={c.id} className={c.resolved ? styles.commentDone : undefined}>
              <p className={styles.commentHead}><strong>{c.author}</strong> <span>{formatPacificDateTime(c.created_at)}{c.resolved ? ' · resolved' : ''}</span></p>
              <p className={styles.commentBody}>{c.body}</p>
              <p className={styles.commentActs}>
                {canEdit && <button type="button" onClick={() => call('/api/docs/comments', { method: 'PATCH', body: JSON.stringify({ id: c.id, resolved: c.resolved ? false : true }) })}>{c.resolved ? 'Reopen' : 'Resolve'}</button>}
                {(c.mine || canEdit) && <button type="button" onClick={() => call(`/api/docs/comments?id=${c.id}`, { method: 'DELETE' })}>Delete</button>}
              </p>
            </li>
          ))}
        </ul>
      )}
      <div className={styles.commentForm}>
        <Textarea rows={3} value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} placeholder="Ask a question or leave a note for whoever looks after this doc" aria-label="Add a comment" />
        {err && <Notice tone="error">{err}</Notice>}
        <div><Button size="sm" loading={busy} disabled={!text.trim()} onClick={send}>Comment</Button></div>
      </div>
    </details>
  );
}

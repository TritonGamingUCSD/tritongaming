'use client';

import { useCallback, useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import { formatPacificDateTime } from '@/lib/core/timezone';
import type { DivisionHat } from '@/components/portal/hubTypes';
import styles from './division.module.css';

interface Announcement {
  id: string;
  title: string;
  body: string;
  created_at: string;
}

// The division's announcements on its Home: everyone in the division reads them; its Heads post and remove them (the Members and Heads are notified when one is posted).
export default function DivisionAnnouncements({ hat }: { hat: DivisionHat }) {
  const canPost = hat.level === 'head' || hat.level === 'staff';
  const [list, setList] = useState<Announcement[] | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    const r = await fetch(`/api/divisions/${hat.id}/announcements`, { cache: 'no-store' }).catch(() => null);
    const j = r?.ok ? await r.json().catch(() => ({})) : {};
    setList((j.announcements as Announcement[]) ?? []);
  }, [hat.id]);
  useEffect(() => {
    void load();
  }, [load]);

  async function send(method: 'POST' | 'DELETE', payload: object) {
    setBusy(true);
    setError('');
    const r = await fetch(`/api/divisions/${hat.id}/announcements`, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (!r?.ok) return setError(j.error || 'That did not work.');
    if (method === 'POST') {
      setTitle('');
      setBody('');
    }
    await load();
  }

  if (list === null || (list.length === 0 && !canPost)) return null;
  return (
    <section className={styles.ann} aria-label="Announcements">
      <h3 className={styles.annTitle}>Announcements</h3>
      {error && <Notice tone="error">{error}</Notice>}
      {list.length === 0 && <p className={styles.nextNone}>Nothing posted yet.</p>}
      <ul className={styles.annList}>
        {list.map((a) => (
          <li key={a.id} className={styles.annItem}>
            <div>
              <strong>{a.title}</strong>
              <small>{formatPacificDateTime(a.created_at, { weekday: true })}</small>
              {a.body && <p>{a.body}</p>}
            </div>
            {canPost && (
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => void send('DELETE', { id: a.id })}>
                Remove
              </Button>
            )}
          </li>
        ))}
      </ul>
      {canPost && (
        <div className={styles.annForm}>
          <input
            className={styles.annInput}
            value={title}
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title, like “Practice moved to 7pm”"
            aria-label="Announcement title"
          />
          <textarea
            className={styles.annInput}
            value={body}
            maxLength={2000}
            rows={3}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Details (optional)"
            aria-label="Announcement details"
          />
          <Button size="sm" disabled={busy || !title.trim()} onClick={() => void send('POST', { title, body })}>
            Post Announcement
          </Button>
        </div>
      )}
    </section>
  );
}

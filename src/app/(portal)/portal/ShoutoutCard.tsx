'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Megaphone } from 'lucide-react';
import Link from '@/components/portal/PortalLink';
import Button from '@/components/ui/Button';
import type { HomeShoutout } from '@/lib/portal/homeExtras';
import styles from './shoutout.module.css';

// One short message from exec at the top of everyone's Home. Exec and admin also get the small form to post or take it down.
export default function ShoutoutCard({ shoutout, canPost }: { shoutout: HomeShoutout | null; canPost: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState('');
  const [link, setLink] = useState('');
  const [days, setDays] = useState(7);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(method: 'POST' | 'DELETE') {
    setBusy(true);
    setError(null);
    const res = await fetch('/api/portal/shoutout', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: method === 'POST' ? JSON.stringify({ message, link_url: link, days }) : undefined,
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      setError(((await res?.json().catch(() => null)) as { error?: string } | null)?.error ?? 'Could not save');
      return;
    }
    setEditing(false);
    setMessage('');
    setLink('');
    router.refresh();
  }

  if (!shoutout && !canPost) return null;
  return (
    <section className={styles.card} aria-label="Shout-out">
      {shoutout && !editing && (
        <div className={styles.row}>
          <Megaphone size={18} aria-hidden="true" className={styles.icon} />
          <p className={styles.text}>
            {shoutout.message}
            {shoutout.link_url && (
              <>
                {' '}
                <Link href={shoutout.link_url} className={styles.link}>
                  Open
                </Link>
              </>
            )}
          </p>
          {canPost && (
            <span className={styles.actions}>
              <button type="button" className={styles.small} onClick={() => setEditing(true)}>
                Replace
              </button>
              <button type="button" className={styles.small} onClick={() => send('DELETE')} disabled={busy}>
                Remove
              </button>
            </span>
          )}
        </div>
      )}
      {!shoutout && canPost && !editing && (
        <button type="button" className={styles.add} onClick={() => setEditing(true)}>
          <Megaphone size={15} aria-hidden="true" /> Post a shout-out for everyone
        </button>
      )}
      {editing && (
        <form
          className={styles.form}
          onSubmit={(e) => {
            e.preventDefault();
            void send('POST');
          }}
        >
          <label className={styles.field}>
            <span>Message</span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={280}
              rows={2}
              required
              placeholder="Thank you to everyone who came to the Smash night!"
            />
          </label>
          <div className={styles.fieldRow}>
            <label className={styles.field}>
              <span>Link (optional)</span>
              <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://… or /portal/events" />
            </label>
            <label className={styles.field}>
              <span>Shows for</span>
              <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
                {[1, 3, 7, 14, 30].map((d) => (
                  <option key={d} value={d}>
                    {d === 1 ? '1 day' : `${d} days`}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {error && <p className={styles.error}>{error}</p>}
          <div className={styles.buttons}>
            <Button size="sm" type="submit" disabled={busy || !message.trim()}>
              Post
            </Button>
            <Button size="sm" variant="ghost" type="button" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Dialog from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import styles from './calendar.module.css';

const webcal = (url: string) => url.replace(/^https?:/, 'webcal:');
const googleSub = (url: string) => `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal(url))}`;

/** Subscribe in Google, Apple or Outlook: the calendar as a link they keep up to date. `manage` is the portal's private link (made, replaced or turned off here); without it `url` is the public one. */
export default function SubscribeDialog({ onClose, manage, url: fixed }: { onClose: () => void; manage?: boolean; url?: string }) {
  const [url, setUrl] = useState<string | null>(fixed ?? null);
  const [loaded, setLoaded] = useState(!manage);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!manage) return;
    fetch('/api/calendar/feed')
      .then((r) => r.json())
      .then((d) => setUrl(d.url ?? null))
      .catch(() => setErr('Could not load your link.'))
      .finally(() => setLoaded(true));
  }, [manage]);

  const call = async (method: 'POST' | 'PUT' | 'DELETE') => {
    setBusy(true);
    setErr('');
    try {
      const r = await fetch('/api/calendar/feed', { method });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Something went wrong.');
      setUrl(d.url ?? null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Something went wrong.');
    }
    setBusy(false);
  };
  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setErr('Copy did not work. Select the link and copy it.');
    }
  };

  return (
    <Dialog title="Subscribe To The Calendar" onClose={onClose} busy={busy}>
      <div className={styles.subscribe}>
        {!loaded && <p>Loading…</p>}
        {loaded && !url && (
          <>
            <p>Get everything on this calendar inside Google Calendar, Apple Calendar or Outlook. It stays up to date by itself. The link is private to you, so do not share it.</p>
            <div className={styles.subActions}>
              <Button onClick={() => call('POST')} loading={busy}>
                Make My Link
              </Button>
            </div>
          </>
        )}
        {loaded && url && (
          <>
            <p>{manage ? 'Your private link. Anyone who has it can see your calendar, so keep it to yourself.' : 'Subscribe once and it stays up to date by itself.'}</p>
            <div className={styles.linkBox}>
              <input readOnly value={url} aria-label="Calendar link" onFocus={(e) => e.currentTarget.select()} />
              <Button variant="secondary" onClick={copy}>
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <div className={styles.subLinks}>
              <a href={googleSub(url)} target="_blank" rel="noreferrer">
                Add To Google
              </a>
              <a href={webcal(url)}>Add To Apple / Outlook</a>
            </div>
            {manage && (
              <div className={styles.subActions}>
                <Button size="sm" variant="secondary" onClick={() => call('PUT')} loading={busy}>
                  Make A New Link
                </Button>
                <Button size="sm" variant="danger" onClick={() => call('DELETE')} loading={busy}>
                  Turn It Off
                </Button>
              </div>
            )}
            {manage && <p style={{ fontSize: '0.78rem' }}>A new link stops the old one working at once. Turning it off removes the link until you make another.</p>}
          </>
        )}
        {err && (
          <p role="alert" style={{ color: 'var(--pp-bad)' }}>
            {err}
          </p>
        )}
      </div>
    </Dialog>
  );
}

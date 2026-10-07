'use client';

import IconButton from '@/components/ui/IconButton';
import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { enablePush, pushSupport } from '@/lib/notifications/pushClient';
import styles from './PushAsk.module.css';

const KEY = 'push-asked';

// The one-time offer to turn on push notifications. It appears only if this browser has never been asked (permission is still "default"), the
// person hasn't said "not now" before (remembered on their account, so on every device, and on this browser), and push is set up. Saying no,
// or closing the browser's own prompt without allowing it, is remembered and it never asks again. It stays available in Profile → Notifications.
export default function PushAsk() {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true; let timer: ReturnType<typeof setTimeout> | undefined;
    (async () => {
      try {
        if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || pushSupport() !== 'ok' || Notification.permission !== 'default' || localStorage.getItem(KEY) === '1') return;
        const r = await fetch('/api/push', { cache: 'no-store' });
        if (!r.ok) return;
        const s = await r.json();
        if (!s.configured || s.declined) { if (s.declined) localStorage.setItem(KEY, '1'); return; }
        // A moment after the page settles, so it doesn't land on top of the first thing they're doing.
        timer = setTimeout(() => { if (live) setShow(true); }, 4000);
      } catch { /* no offer */ }
    })();
    return () => { live = false; if (timer) clearTimeout(timer); };
  }, []);

  async function remember() {
    try { localStorage.setItem(KEY, '1'); } catch { /* ignore */ }
    await fetch('/api/push', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ declined: true }) }).catch(() => {});
  }
  async function turnOn() {
    setBusy(true);
    const r = await enablePush();
    setBusy(false); setShow(false);
    // Allowed: done. Blocked, or the browser's prompt was closed without an answer: that is a no, so don't ask again.
    if (!r.ok) await remember(); else try { localStorage.setItem(KEY, '1'); } catch { /* ignore */ }
  }
  async function notNow() { setShow(false); await remember(); }

  if (!show) return null;
  return (
    <div className={styles.wrap} role="dialog" aria-label="Turn on notifications">
      <span className={styles.icon}><Bell size={18} aria-hidden="true" /></span>
      <div className={styles.text}>
        <strong>Get notified on this device?</strong>
        <span>Reminders, invites and ticket updates, even when the portal is closed. You can change this any time in Profile.</span>
      </div>
      <div className={styles.buttons}>
        <button type="button" className={styles.on} onClick={turnOn} disabled={busy}>Turn on</button>
        <button type="button" className={styles.no} onClick={notNow} disabled={busy}>Not now</button>
      </div>
      <IconButton kind="close" size="sm" label="Close and don’t ask again" className={styles.close} onClick={notNow} />
    </div>
  );
}

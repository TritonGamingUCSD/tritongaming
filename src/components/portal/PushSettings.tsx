'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bell, BellOff, Send, Share, Smartphone } from 'lucide-react';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import { currentSubscription, disablePush, enablePush, pushSupport, type PushSupport } from '@/lib/notifications/pushClient';
import styles from './PushSettings.module.css';

interface Settings { configured: boolean; devices: number; muted: string[]; categories: { id: string; label: string; hint: string }[] }

// Web push settings: turn notifications on for this device, choose which kinds to receive, and send yourself a test.
export default function PushSettings() {
  const [support, setSupport] = useState<PushSupport | null>(null);
  const [perm, setPerm] = useState<NotificationPermission>('default');
  const [here, setHere] = useState(false);          // is THIS device subscribed
  const [s, setS] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    const sup = pushSupport();
    setSupport(sup);
    if (sup === 'ok') { setPerm(Notification.permission); setHere(!!(await currentSubscription())); }
    try { const r = await fetch('/api/push', { cache: 'no-store' }); if (r.ok) setS(await r.json()); } catch { /* shown as loading */ }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function turnOn() {
    setBusy(true); setError(''); setNote('');
    const r = await enablePush();
    setBusy(false);
    if (!r.ok && r.error) setError(r.error);
    await load();
  }
  async function turnOff() {
    setBusy(true); setError(''); setNote('');
    await disablePush();
    setBusy(false);
    await load();
  }
  async function toggle(id: string, on: boolean) {
    if (!s) return;
    const muted = on ? s.muted.filter((m) => m !== id) : [...s.muted, id];
    setS({ ...s, muted });
    const r = await fetch('/api/push', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ muted }) });
    if (!r.ok) { setError('Couldn’t save that.'); await load(); }
  }
  async function test() {
    setBusy(true); setError(''); setNote('');
    const r = await fetch('/api/push/test', { method: 'POST' });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) setError(j.error || 'Couldn’t send a test.');
    else setNote(j.sent ? 'Sent. It should arrive in a moment.' : 'Nothing was sent: no device has notifications on.');
  }

  if (support === null || s === null) return <p className={styles.muted}>Loading…</p>;
  return (
    <section className={styles.card} aria-label="Push notifications">
      <div className={styles.head}>
        <span className={styles.icon}><Bell size={18} aria-hidden="true" /></span>
        <div>
          <h2 className={styles.title}>Push notifications</h2>
          <p className={styles.sub}>Get your reminders, invites and ticket updates on this device even when the portal isn’t open. You still see everything in the bell.</p>
        </div>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {note && <Notice tone="success">{note}</Notice>}

      {!s.configured ? (
        <p className={styles.muted}>Push notifications aren’t set up on this site yet.</p>
      ) : support === 'ios-install' ? (
        <div className={styles.install}>
          <Smartphone size={18} aria-hidden="true" />
          <p>On iPhone and iPad, notifications work once Triton Gaming is on your Home Screen. In Safari tap <Share size={13} aria-label="Share" className={styles.inline} /> then <b>Add to Home Screen</b>, open it from there, and come back to this page.</p>
        </div>
      ) : support === 'unsupported' ? (
        <p className={styles.muted}>This browser doesn’t support push notifications. Chrome, Edge, Firefox and Safari (macOS 13+, or iPhone with the app on your Home Screen) do.</p>
      ) : perm === 'denied' ? (
        <p className={styles.muted}>Notifications are blocked for this site in your browser. Allow them in the site settings (the lock or tune icon by the address), then reload this page.</p>
      ) : !here ? (
        <div className={styles.row}>
          <Button onClick={turnOn} loading={busy}><Bell size={15} aria-hidden="true" /> Turn on for this device</Button>
          {s.devices > 0 && <span className={styles.muted}>On for {s.devices} other {s.devices === 1 ? 'device' : 'devices'} already.</span>}
        </div>
      ) : (
        <>
          <p className={styles.on}><Bell size={14} aria-hidden="true" /> On for this device{s.devices > 1 ? ` (and ${s.devices - 1} other ${s.devices === 2 ? 'device' : 'devices'})` : ''}.</p>
          <fieldset className={styles.kinds}>
            <legend className={styles.legend}>Send me notifications about</legend>
            {s.categories.map((c) => {
              const on = !s.muted.includes(c.id);
              return (
                <label key={c.id} className={styles.kind}>
                  <input type="checkbox" checked={on} onChange={(e) => toggle(c.id, e.target.checked)} />
                  <span><b>{c.label}</b><small>{c.hint}</small></span>
                </label>
              );
            })}
          </fieldset>
          <div className={styles.row}>
            <Button variant="secondary" size="sm" onClick={test} loading={busy}><Send size={14} aria-hidden="true" /> Send a test</Button>
            <Button variant="ghost" size="sm" onClick={turnOff} disabled={busy}><BellOff size={14} aria-hidden="true" /> Turn off on this device</Button>
          </div>
        </>
      )}
    </section>
  );
}

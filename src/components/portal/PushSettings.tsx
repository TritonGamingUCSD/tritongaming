'use client';

import { formatPacificDate } from '@/lib/core/timezone';
import Loading from '@/components/Loading/Loading';
import { useCallback, useEffect, useState } from 'react';
import { Bell, BellOff, Send, Share, Smartphone, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import { currentSubscription, disablePush, enablePush, pushSupport, type PushSupport } from '@/lib/notifications/pushClient';
import { endpointFingerprint } from '@/lib/notifications/devices';
import styles from './PushSettings.module.css';

interface Device { id: string; fp: string; label: string; added: string; lastSent: string | null }
interface Settings { configured: boolean; devices: number; list?: Device[]; muted: string[]; categories: { id: string; label: string; hint: string }[] }

// Web push settings: turn notifications on for this device, choose which kinds to receive, and send yourself a test.
export default function PushSettings() {
  const [support, setSupport] = useState<PushSupport | null>(null);
  const [perm, setPerm] = useState<NotificationPermission>('default');
  const [here, setHere] = useState(false);          // does THIS browser hold a subscription
  const [hereFp, setHereFp] = useState('');         // its short id, to pick it out of the list
  const [s, setS] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    const sup = pushSupport();
    setSupport(sup);
    if (sup === 'ok') { setPerm(Notification.permission); const sub = await currentSubscription(); setHere(!!sub); setHereFp(sub ? await endpointFingerprint(sub.endpoint) : ''); }
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
  async function removeDevice(d: Device) {
    setBusy(true); setError(''); setNote('');
    if (d.fp === hereFp) await disablePush();   // this browser: also drop its own subscription
    const r = await fetch('/api/push', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: d.id }) });
    setBusy(false);
    if (!r.ok) setError('Couldn’t remove that device.');
    else setNote(`${d.label} won’t get notifications any more.`);
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
    else if (!j.devices) setNote('Nothing was sent: no device has notifications on.');
    else if (j.sent && !j.failed?.length) setNote('Sent. It should arrive in a moment.');
    else {
      const why = (j.failed as { service: string; status?: number; reason?: string }[]).map((f) => `${f.service}${f.status ? ` ${f.status}` : ''}${f.reason ? ` (${f.reason})` : ''}`).join('; ');
      setError(`${j.sent ? `Sent to ${j.sent} of ${j.devices} devices. ` : ''}The push service refused ${j.failed.length === 1 ? 'a device' : `${j.failed.length} devices`}: ${why}`);
    }
  }

  if (support === null || s === null) return <Loading variant="inline" label="Loading…" />;
  const list = s.list ?? [];
  const known = list.some((d) => d.fp === hereFp);   // a browser the server no longer lists (removed from another device) counts as off here
  const day = (iso: string) => formatPacificDate(iso);
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
          <p>On iPhone and iPad, notifications work once the portal is on your Home Screen. In Safari tap <Share size={13} aria-label="Share" className={styles.inline} /> then <b>Add to Home Screen</b> (it is added as “TG Portal”), open it from there, and come back to this page.</p>
        </div>
      ) : support === 'unsupported' ? (
        <p className={styles.muted}>This browser doesn’t support push notifications. Chrome, Edge, Firefox and Safari (macOS 13+, or iPhone with the app on your Home Screen) do.</p>
      ) : perm === 'denied' ? (
        <p className={styles.muted}>Notifications are blocked for this site in your browser. Allow them in the site settings (the lock or tune icon by the address), then reload this page.</p>
      ) : !(here && known) ? (
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

      {s.configured && list.length > 0 && (
        <div className={styles.devices}>
          <h3 className={styles.legend}>Devices with notifications on</h3>
          <ul className={styles.deviceList}>
            {list.map((d) => (
              <li key={d.id} className={styles.device}>
                <div className={styles.deviceText}>
                  <b>{d.label}{d.fp === hereFp && <span className={styles.here}>This device</span>}</b>
                  <small>Added {day(d.added)} · {d.lastSent ? `last notification ${day(d.lastSent)}` : 'no notification sent yet'}</small>
                </div>
                <Button variant="ghost" size="sm" onClick={() => removeDevice(d)} disabled={busy} aria-label={`Remove ${d.label}`}><X size={14} aria-hidden="true" /> Remove</Button>
              </li>
            ))}
          </ul>
          <p className={styles.muted}>Not sure which is which? The model, browser and the dates help. Remove one you don’t recognise or no longer use. A device you remove can turn notifications on again from its own screen.</p>
        </div>
      )}
    </section>
  );
}

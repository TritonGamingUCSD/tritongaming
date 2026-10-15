'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Download, Maximize2, X } from 'lucide-react';
import Notice from '@/components/ui/Notice';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import StyledQRCode, { type StyledQRCodeHandle } from '@/components/StyledQRCode/StyledQRCode';
import { DEFAULT_QR_OPTIONS } from '@/lib/qr/qrCodeStyling';
import styles from './selfCheckin.module.css';
import sectionStyles from './checkinsection.module.css';

interface Event { id: string; title: string; slug?: string | null; start_date: string; self_checkin_enabled?: boolean }

// Officer side of self check-in: switch it on for an event, then show attendees the QR on a screen, copy the link, or download the QR to print.
// Staff scanning (the Tickets tab) is separate and keeps working whether this is on or off. Attendees land on tritongaming.org/in/<event>, which
// signs them in and checks them in (see api/checkin/self).
export default function SelfCheckinPanel({ events }: { events: Event[] }) {
  const [eventId, setEventId] = useState(events[0]?.id ?? '');
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() => Object.fromEntries(events.map((e) => [e.id, !!e.self_checkin_enabled])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [full, setFull] = useState(false);
  const [origin, setOrigin] = useState('');   // read after mount, so the server and the browser draw the same first frame
  const qrRef = useRef<StyledQRCodeHandle>(null);
  useEffect(() => { setOrigin(window.location.origin); }, []);

  const event = events.find((e) => e.id === eventId) ?? events[0];
  const on = !!(event && enabled[event.id]);
  const link = origin && event ? `${origin}/in/${event.slug || event.id}` : '';
  const options = useMemo(() => ({ ...DEFAULT_QR_OPTIONS, data: link || 'https://tritongaming.org' }), [link]);

  if (!event) return <p className={styles.hint}>No upcoming events.</p>;

  async function toggle() {
    if (!event) return;
    setBusy(true); setError('');
    try {
      const res = await fetch(`/api/events/${event.id}/self-checkin`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ enabled: !on }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) setError(j.error || 'Could not change this.');
      else setEnabled((p) => ({ ...p, [event.id]: !on }));
    } catch { setError('Network error. Try again.'); }
    setBusy(false);
  }

  async function copy() {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { setError('Could not copy. Select the link and copy it by hand.'); }
  }

  return (
    <div className={styles.panel}>
      <Select className={sectionStyles.eventSelect} value={eventId} onChange={(e) => setEventId(e.target.value)}>
        {events.map((e) => <option key={e.id} value={e.id}>{e.title}{enabled[e.id] ? ' (on)' : ''}</option>)}
      </Select>

      <p className={styles.hint}>
        Attendees scan this QR with their own phone, sign in, and are checked in. Staff scanning on the Tickets tab keeps working either way. It closes by itself when the event ends.
      </p>

      {error && <Notice tone="error">{error}</Notice>}

      <div className={styles.switchRow}>
        <div>
          <strong>Self check-in is {on ? 'on' : 'off'}</strong>
          <p className={styles.sub}>{on ? 'People who scan the QR are checked in.' : 'Scanning the QR shows "not open for this event".'}</p>
        </div>
        <Button variant={on ? 'secondary' : 'primary'} onClick={() => void toggle()} loading={busy}>{on ? 'Turn off' : 'Turn on'}</Button>
      </div>

      <div className={`${styles.qrCard} ${on ? '' : styles.qrOff}`}>
        <div className={styles.qrBox}><StyledQRCode ref={qrRef} options={options} className={styles.qr} /></div>
        <code className={styles.link}>{link}</code>
        <div className={styles.actions}>
          <Button variant="secondary" size="sm" onClick={() => setFull(true)}><Maximize2 size={14} aria-hidden="true" /> Show on screen</Button>
          <Button variant="secondary" size="sm" onClick={() => void copy()}><Copy size={14} aria-hidden="true" /> {copied ? 'Copied' : 'Copy link'}</Button>
          <Button variant="secondary" size="sm" onClick={() => void qrRef.current?.download(`${event.slug || 'event'}-self-checkin`)}><Download size={14} aria-hidden="true" /> Download QR</Button>
        </div>
        {!on && <p className={styles.sub}>Turn it on above so the code works.</p>}
      </div>

      {full && (
        <div className={styles.full} role="dialog" aria-modal="true" aria-label="Self check-in QR code">
          <button type="button" className={styles.fullClose} onClick={() => setFull(false)} aria-label="Close"><X size={22} /></button>
          <p className={styles.fullTitle}>{event.title}</p>
          <p className={styles.fullSub}>Scan to check in</p>
          <div className={styles.fullQr}><StyledQRCode options={{ ...options, size: 900 }} className={styles.qrBig} /></div>
          <code className={styles.fullLink}>{link.replace(/^https?:\/\//, '')}</code>
          {!on && <p className={styles.fullWarn}>Self check-in is currently off for this event.</p>}
        </div>
      )}
    </div>
  );
}

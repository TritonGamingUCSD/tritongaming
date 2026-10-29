'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Download, Maximize2, X } from 'lucide-react';
import Notice from '@/components/ui/Notice';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import StyledQRCode, { type StyledQRCodeHandle } from '@/components/StyledQRCode/StyledQRCode';
import { DEFAULT_QR_OPTIONS } from '@/lib/qr/qrCodeStyling';
import { SELF_CHECKIN_LABELS, cleanSelfCheckinMode, type SelfCheckinMode } from '@/lib/events/selfCheckin';
import { formatPacificDateTime } from '@/lib/core/timezone';
import styles from './selfCheckin.module.css';
import sectionStyles from './checkinsection.module.css';

interface Event { id: string; title: string; slug?: string | null; start_date: string; end_date?: string | null; self_checkin_mode?: SelfCheckinMode }

const MODE_HELP: Record<SelfCheckinMode, string> = {
  off: 'Scanning the QR shows "not open for this event". Staff scanning is not affected.',
  until_end: 'Works any time from now until the event ends, then closes by itself. Multi-day events with hours set close at the end of each day.',
  forever: 'Never closes by itself, even after the event, until someone turns it off. Check-ins still earn points.',
};

// Self check-in for an event: anyone who can run check-in sees the QR here (show it on a screen, copy the link, download it to print). Only exec and admin can
// change the setting. Staff scanning (the Tickets tab) is separate and keeps working whatever this is set to. Attendees land on tritongaming.org/in/<event>,
// which signs them in and checks them in (see api/checkin/self).
export default function SelfCheckinPanel({ events, canControl }: { events: Event[]; canControl: boolean }) {
  const [eventId, setEventId] = useState(events[0]?.id ?? '');
  const [modes, setModes] = useState<Record<string, SelfCheckinMode>>(() => Object.fromEntries(events.map((e) => [e.id, cleanSelfCheckinMode(e.self_checkin_mode)])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [full, setFull] = useState(false);
  const [origin, setOrigin] = useState('');   // read after mount, so the server and the browser draw the same first frame
  const qrRef = useRef<StyledQRCodeHandle>(null);
  useEffect(() => { setOrigin(window.location.origin); }, []);

  const event = events.find((e) => e.id === eventId) ?? events[0];
  const mode = event ? modes[event.id] ?? 'off' : 'off';
  const on = mode !== 'off';
  const link = origin && event ? `${origin}/in/${event.slug || event.id}` : '';
  const options = useMemo(() => ({ ...DEFAULT_QR_OPTIONS, data: link || 'https://tritongaming.org' }), [link]);
  const closesAt = event?.end_date ? formatPacificDateTime(event.end_date, { weekday: true }) : null;

  if (!event) return <p className={styles.hint}>No upcoming events.</p>;

  async function choose(next: SelfCheckinMode) {
    if (!event || next === mode || busy) return;
    setBusy(true); setError('');
    try {
      const res = await fetch(`/api/events/${event.id}/self-checkin`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: next }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) setError(j.error || 'Could not change this.');
      else setModes((p) => ({ ...p, [event.id]: next }));
    } catch { setError('Network error. Try again.'); }
    setBusy(false);
  }

  async function copy() {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { setError('Could not copy. Select the link and copy it by hand.'); }
  }

  return (
    <div className={styles.panel}>
      <Select className={sectionStyles.eventSelect} value={eventId} onChange={(e) => setEventId(e.target.value)}>
        {events.map((e) => <option key={e.id} value={e.id}>{e.title}{modes[e.id] && modes[e.id] !== 'off' ? ' (on)' : ''}</option>)}
      </Select>

      <p className={styles.hint}>
        Attendees scan this QR with their own phone, sign in, and are checked in. Staff scanning on the Tickets tab keeps working either way.
      </p>

      {error && <Notice tone="error">{error}</Notice>}

      <div className={styles.modeCard}>
        <strong>Self check-in</strong>
        <div className={styles.modes} role="radiogroup" aria-label="Self check-in setting">
          {(['off', 'until_end', 'forever'] as const).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={mode === m} disabled={!canControl || busy} className={`${styles.modeBtn} ${mode === m ? styles.modeOn : ''}`} onClick={() => void choose(m)}>
              {SELF_CHECKIN_LABELS[m]}
            </button>
          ))}
        </div>
        <p className={styles.sub}>{MODE_HELP[mode]}{mode === 'until_end' && closesAt ? ` This event ends ${closesAt} (Pacific).` : ''}</p>
        {!canControl && <p className={styles.sub}>Only exec and admin can change this. You can still show the QR below.</p>}
      </div>

      <div className={`${styles.qrCard} ${on ? '' : styles.qrOff}`}>
        <div className={styles.qrBox}><StyledQRCode ref={qrRef} options={options} className={styles.qr} /></div>
        <code className={styles.link}>{link}</code>
        <div className={styles.actions}>
          <Button variant="secondary" size="sm" onClick={() => setFull(true)}><Maximize2 size={14} aria-hidden="true" /> Show on screen</Button>
          <Button variant="secondary" size="sm" onClick={() => void copy()}><Copy size={14} aria-hidden="true" /> {copied ? 'Copied' : 'Copy link'}</Button>
          <Button variant="secondary" size="sm" onClick={() => void qrRef.current?.download(`${event.slug || 'event'}-self-checkin`)}><Download size={14} aria-hidden="true" /> Download QR</Button>
        </div>
        {!on && <p className={styles.sub}>The code does not work until self check-in is turned on{canControl ? ' above' : ' by an exec'}.</p>}
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

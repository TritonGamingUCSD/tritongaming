'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Mail, Send } from 'lucide-react';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import Loading from '@/components/Loading/Loading';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { useLiveParams, usePortalParams } from '@/lib/portal/usePortalParams';
import styles from './eventEmails.module.css';

interface EventItem { id: string; title: string; start_date: string; is_published: boolean }
interface HistoryRow { id: string; kind: string; subject: string; sent_by: string; sent_at: string; recipients: number; sent: number; failed: number; skipped_optout: number; skipped_no_email: number }
interface Info {
  event: EventItem; subject: string; preview: string; recipients: number; ticketHolders: number; skippedOptOut: number; skippedNoEmail: number;
  usedToday: number; left: number; limit: number; history: HistoryRow[];
}
const SECONDS = 60;   // the cancel window after pressing Send
const KINDS = [{ id: 'reminders', label: 'Reminder' }, { id: 'updates', label: 'Update' }] as const;
type Kind = (typeof KINDS)[number]['id'];
const when = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const day = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// Event Emails: pick an event, start from a Reminder (or an Update), adjust the subject and add a short note, see the email exactly as it will look, send a test to yourself, and send it
// to everyone with a ticket. Pressing Send starts a 60-second countdown you can cancel; after it, the emails go out a batch at a time while this page stays open.
export default function EventEmailsTab() {
  const params = useLiveParams();
  const setParams = usePortalParams();
  const [events, setEvents] = useState<EventItem[] | null>(null);
  const [setup, setSetup] = useState<{ configured: boolean; from: string; replyTo: string; limit: number } | null>(null);
  const [eventId, setEventId] = useState(() => params.get('emailEvent') ?? '');
  const [kind, setKind] = useState<Kind>('reminders');
  const [subject, setSubject] = useState('');
  const [subjectEdited, setSubjectEdited] = useState(false);
  const [note, setNote] = useState('');
  const [cover, setCover] = useState(true);
  const [info, setInfo] = useState<Info | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState<'' | 'test'>('');
  const [count, setCount] = useState<number | null>(null);          // seconds left in the cancel window
  const [progress, setProgress] = useState<{ id: string; done: number; total: number } | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let live = true;
    void fetch('/api/event-emails', { cache: 'no-store' }).then((r) => r.json()).then((j) => {
      if (!live) return;
      if (j.error) { setError(j.error); setEvents([]); return; }
      setSetup({ configured: j.configured, from: j.from, replyTo: j.replyTo, limit: j.limit });
      setEvents(j.events);
    }).catch(() => { if (live) { setError('Couldn’t load the events.'); setEvents([]); } });
    return () => { live = false; };
  }, []);

  const refresh = useCallback(async (id: string, k: Kind, subj: string, n: string, cvr: boolean) => {
    const q = new URLSearchParams({ event_id: id, kind: k, cover: cvr ? '1' : '0', ...(subj ? { subject: subj } : {}), ...(n ? { note: n } : {}) });
    const r = await fetch(`/api/event-emails?${q}`, { cache: 'no-store' }).catch(() => null);
    const j = await r?.json().catch(() => null);
    if (!r?.ok || !j) { setError(j?.error ?? 'Couldn’t load that event.'); return; }
    setError('');
    setInfo(j);
    if (!subj) setSubject(j.subject);
  }, []);
  // The preview follows what is typed (a moment after typing stops).
  useEffect(() => {
    if (!eventId) { setInfo(null); return; }
    const t = setTimeout(() => void refresh(eventId, kind, subjectEdited ? subject : '', note, cover), 350);
    return () => clearTimeout(t);
  }, [eventId, kind, subject, subjectEdited, note, cover, refresh]);

  const pickEvent = (id: string) => { setEventId(id); setSubjectEdited(false); setSubject(''); setMessage(''); setParams({ emailEvent: id || null }); };
  const pickKind = (k: Kind) => { setKind(k); setSubjectEdited(false); setSubject(''); };

  async function test() {
    setBusy('test'); setError(''); setMessage('');
    const r = await fetch('/api/event-emails', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'test', event_id: eventId, kind, subject, note, cover }) }).catch(() => null);
    const j = await r?.json().catch(() => ({}));
    setBusy('');
    if (r?.ok) setMessage(`A test went to ${j.to}. It can take a minute to arrive.`); else setError(j?.error ?? 'The test couldn’t be sent.');
  }

  // The 60-second cancel window, then the send.
  function startCountdown() {
    setError(''); setMessage(''); setCount(SECONDS);
    timer.current = setInterval(() => setCount((c) => (c === null ? c : c - 1)), 1000);
  }
  const cancel = () => { if (timer.current) clearInterval(timer.current); setCount(null); setMessage('Cancelled. Nothing was sent.'); };
  useEffect(() => { if (count === 0) { if (timer.current) clearInterval(timer.current); setCount(null); void send(); } }, [count]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  async function send() {
    const r = await fetch('/api/event-emails', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'start', event_id: eventId, kind, subject, note, cover }) }).catch(() => null);
    const j = await r?.json().catch(() => ({}));
    if (!r?.ok) { setError(j?.error ?? 'The send couldn’t start.'); return; }
    await runBatches(j.id, 0, j.recipients);
  }
  async function runBatches(id: string, from: number, total: number) {
    let at = from;
    setProgress({ id, done: at, total });
    for (;;) {
      const r = await fetch(`/api/event-emails/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ from: at }) }).catch(() => null);
      const j = await r?.json().catch(() => ({}));
      if (!r?.ok) { setError(`${j?.error ?? 'The send stopped.'} It can be continued from the history below.`); break; }
      at = j.next;
      setProgress({ id, done: at, total });
      if (j.done) { setMessage(`Sent to ${total} ${total === 1 ? 'person' : 'people'}.`); break; }
    }
    setProgress(null);
    await refresh(eventId, kind, subjectEdited ? subject : '', note, cover);
  }

  if (!events) return <div className={styles.page}>{error ? <Notice tone="error">{error}</Notice> : <Loading variant="inline" label="Loading…" />}</div>;
  const sorted = [...events].sort((a, b) => Number(b.is_published) - Number(a.is_published) || b.start_date.localeCompare(a.start_date));
  const over = info ? info.recipients > info.left : false;
  const sending = count !== null || !!progress;
  const canSend = !!info && info.recipients > 0 && !over && !!subject.trim() && !sending && !!setup?.configured && info.event.is_published;
  return (
    <div className={styles.page}>
      {setup && !setup.configured && <Notice tone="error">Email isn’t set up on this site yet (GMAIL_USER and GMAIL_APP_PASSWORD).</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
      {message && <Notice tone="success">{message}</Notice>}
      <div className={styles.grid}>
        <section className={styles.form} aria-label="Write the email">
          <Field label="Event">
            <Select value={eventId} onChange={(e) => pickEvent(e.target.value)} aria-label="Event">
              <option value="">Choose an event…</option>
              {sorted.map((e) => <option key={e.id} value={e.id}>{e.title} · {day(e.start_date)}{e.is_published ? '' : ' (draft)'}</option>)}
            </Select>
          </Field>
          {eventId && (
            <>
              <div className={styles.kinds} role="group" aria-label="Start from">
                {KINDS.map((k) => <button key={k.id} type="button" className={`${styles.kind} ${kind === k.id ? styles.kindOn : ''}`} aria-pressed={kind === k.id} onClick={() => pickKind(k.id)}>{k.label}</button>)}
              </div>
              <Field label="Subject"><Input value={subject} maxLength={200} onChange={(e) => { setSubject(e.target.value); setSubjectEdited(true); }} /></Field>
              <Field label="Note" hint="Optional. A few lines above the ticket button, like where to park or what to bring. Blank lines start a new paragraph."><Textarea rows={4} value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} /></Field>
              <label className={styles.check}><input type="checkbox" checked={cover} onChange={(e) => setCover(e.target.checked)} /> Show the event’s cover picture (small, beside the date)</label>
              {info && (
                <div className={styles.audience} aria-live="polite">
                  <b>{info.recipients} {info.recipients === 1 ? 'person' : 'people'} will get this</b>
                  <span>{info.ticketHolders} with a ticket{info.skippedOptOut ? ` · ${info.skippedOptOut} opted out` : ''}{info.skippedNoEmail ? ` · ${info.skippedNoEmail} with no email` : ''}</span>
                  <span className={over ? styles.bad : undefined}>Today: {info.usedToday} of {info.limit} emails used{over ? '. Not enough left for this one.' : ''}</span>
                  {!info.event.is_published && <span className={styles.bad}>This event is a draft, so it can’t be emailed yet.</span>}
                  {setup && <span className={styles.dim}>From {setup.from}; replies go to {setup.replyTo}.</span>}
                </div>
              )}
              <div className={styles.actions}>
                {count === null && !progress && <Button onClick={startCountdown} disabled={!canSend}><Send size={15} aria-hidden="true" /> Send To {info?.recipients ?? 0}</Button>}
                {count !== null && <Button variant="danger" onClick={cancel}>Cancel — Sending In {count}</Button>}
                {progress && <span className={styles.progress} role="status">Sending… {progress.done} of {progress.total}. Keep this page open.</span>}
                <Button variant="secondary" onClick={test} loading={busy === 'test'} disabled={!subject.trim() || sending || !setup?.configured}><Mail size={15} aria-hidden="true" /> Send Test To Me</Button>
              </div>
              {count !== null && <p className={styles.dim}>It goes out when the countdown ends. Press Cancel to stop it. After that it can’t be called back.</p>}
            </>
          )}
        </section>
        <section className={styles.preview} aria-label="Preview">
          {info ? <iframe title="How the email will look" srcDoc={info.preview} className={styles.frame} sandbox="" /> : <p className={styles.dim}>{eventId ? <Loading variant="inline" label="Loading…" /> : 'Choose an event to see the email.'}</p>}
        </section>
      </div>
      {info && info.history.length > 0 && (
        <section className={styles.history} aria-label="Sent before">
          <h3 className={styles.h}>Sent For This Event</h3>
          <ul>
            {info.history.map((h) => {
              const handled = h.sent + h.failed;
              const incomplete = handled < h.recipients;
              return (
                <li key={h.id}>
                  <div><b>{h.subject}</b><small>{h.kind === 'reminders' ? 'Reminder' : 'Update'} · {h.sent_by} · {when(h.sent_at)}</small></div>
                  <div className={styles.counts}>
                    <span>{h.sent} of {h.recipients} sent{h.failed ? ` · ${h.failed} failed` : ''}</span>
                    {(h.skipped_optout > 0 || h.skipped_no_email > 0) && <small>{h.skipped_optout} opted out · {h.skipped_no_email} no email</small>}
                    {incomplete && !sending && <Button size="sm" variant="secondary" onClick={() => void runBatches(h.id, handled, h.recipients)}>Continue</Button>}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

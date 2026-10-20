'use client';

import { useEffect, useMemo, useState } from 'react';
import { Send, Plug } from 'lucide-react';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { confirmHold } from '@/lib/ui/confirmHold';
import { MAX_BLAST, parseRecipients } from '@/lib/email/recipients';
import { emailHtml } from '@/lib/email/template';
import { APPLE_ICON_DATA_URI } from '@/lib/site/appleIcon';
import styles from './email.module.css';

interface Result { to: string; ok: boolean; error?: string }

// Admin → System → Email (Test): send one message to a list of addresses you type or paste, each as its own email (nobody sees the others). Sent through the club's Gmail account with
// nodemailer (lib/email/mailer.ts). For trying things out: it only ever mails the addresses you give it, never a member list.
export default function EmailBlastPanel() {
  const [info, setInfo] = useState<{ configured: boolean; from: string } | null>(null);
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [note, setNote] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [results, setResults] = useState<Result[] | null>(null);

  useEffect(() => { fetch('/api/admin/email', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then(setInfo).catch(() => {}); }, []);
  const { valid, bad } = useMemo(() => parseRecipients(to), [to]);
  const html = useMemo(() => emailHtml({ subject: subject || 'Subject', message: message || 'Your message', logoSrc: APPLE_ICON_DATA_URI }), [subject, message]);
  const tooMany = valid.length > MAX_BLAST;
  const ready = !!info?.configured && valid.length > 0 && !tooMany && subject.trim() && message.trim();

  async function check() {
    setChecking(true); setNote(null);
    try {
      const r = await fetch('/api/admin/email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'verify' }) });
      const j = await r.json().catch(() => ({}));
      setNote(j.ok ? { tone: 'success', text: `Connected. Gmail accepts the login for ${info?.from}. Nothing was sent.` } : { tone: 'error', text: j.error || 'Couldn’t connect.' });
    } catch { setNote({ tone: 'error', text: 'Network error.' }); }
    setChecking(false);
  }

  async function send() {
    if (!ready) return;
    if (valid.length > 3 && !(await confirmHold({ title: `Send to ${valid.length} people?`, message: 'Each gets this email from the club’s Gmail account. It can’t be recalled.', confirmLabel: 'Hold to send' }))) return;
    setBusy(true); setNote(null); setResults(null);
    try {
      const r = await fetch('/api/admin/email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recipients: to, subject, message }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setNote({ tone: 'error', text: j.error || 'Couldn’t send.' }); }
      else {
        const res = j.results as Result[];
        setResults(res);
        const okCount = res.filter((x) => x.ok).length;
        setNote({ tone: okCount === res.length ? 'success' : 'error', text: `${okCount} of ${res.length} sent.` });
      }
    } catch { setNote({ tone: 'error', text: 'Network error.' }); }
    setBusy(false);
  }

  if (!info) return <p className={styles.intro}>Loading…</p>;
  return (
    <div className={styles.wrap}>
      <p className={styles.intro}>Send one message to a list of addresses, each as its own email in the club’s template (logo, colours, footer), from {info.configured ? <strong>{info.from}</strong> : 'the club’s Gmail account'}. This is for testing: it only mails the addresses you type here. Gmail allows about 500 recipients a day.</p>
      {!info.configured && <Notice tone="error">Email isn’t set up. Add GMAIL_USER and GMAIL_APP_PASSWORD (a Google app password) to .env.local and the host’s settings.</Notice>}
      <div className={styles.split}>
      <div className={styles.card}>
        <Field label="To" hint="Paste or type addresses, separated by commas, spaces or new lines.">
          <Textarea value={to} onChange={(e) => setTo(e.target.value)} rows={3} placeholder="name@ucsd.edu, other@gmail.com" aria-label="Recipients" />
        </Field>
        <span className={`${styles.count} ${bad.length || tooMany ? styles.countBad : ''}`}>
          {valid.length} {valid.length === 1 ? 'address' : 'addresses'}{tooMany ? ` (the most is ${MAX_BLAST})` : ''}{bad.length ? ` · not an address: ${bad.slice(0, 3).join(', ')}${bad.length > 3 ? '…' : ''}` : ''}
        </span>
        <Field label="Subject"><Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150} aria-label="Subject" /></Field>
        <div className={styles.tall}>
          <Field label="Message" hint="Plain text. A blank line starts a new paragraph."><Textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={10000} aria-label="Message" /></Field>
        </div>
        <div className={styles.row}>
          <Button onClick={send} loading={busy} disabled={!ready}><Send size={15} aria-hidden="true" /> Send {valid.length > 1 ? `To ${valid.length}` : ''}</Button>
          <Button variant="secondary" onClick={check} loading={checking} disabled={!info.configured}><Plug size={15} aria-hidden="true" /> Check Connection</Button>
        </div>
        {note && <Notice tone={note.tone}>{note.text}</Notice>}
        {results && (
          <ul className={styles.results} aria-label="Results">
            {results.map((r) => <li key={r.to}><span className={r.ok ? styles.ok : styles.fail}>{r.ok ? 'Sent' : 'Failed'}</span> {r.to}{r.error && <span className={styles.reason}>{r.error}</span>}</li>)}
          </ul>
        )}
      </div>
      <aside className={styles.side} aria-label="Email preview">
        <span className={styles.sideLabel}>Preview</span>
        <iframe className={styles.preview} title="Email preview" sandbox="" srcDoc={html} />
      </aside>
      </div>
    </div>
  );
}

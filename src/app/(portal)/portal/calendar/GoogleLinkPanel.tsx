'use client';

import { useCallback, useEffect, useState } from 'react';
import { Link2Off, Lock } from 'lucide-react';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import { confirmHold } from '@/lib/confirmHold';
import styles from './calendar.module.css';

interface Account { id: string; email: string; showTitles: boolean; connectedAt: string; error: string | null }
interface Status { configured: boolean; accounts: Account[]; max: number }

const RESULT: Record<string, { tone: 'success' | 'warning' | 'error'; text: string }> = {
  linked: { tone: 'success', text: 'Linked. Your Google Calendar events now show here, for you only.' },
  denied: { tone: 'warning', text: 'Nothing was linked: you chose not to give access on Google’s screen.' },
  no_scope: { tone: 'warning', text: 'Nothing was linked: the “see your calendar events” box was unticked on Google’s screen.' },
  too_many: { tone: 'warning', text: 'You’ve reached the limit of linked Google accounts. Unlink one to add another.' },
  failed: { tone: 'error', text: 'Couldn’t link your calendar. Try again in a moment.' },
  not_configured: { tone: 'warning', text: 'Linking Google Calendar isn’t set up on this site yet.' },
};

// Optional, and separate from signing in: you can sign in with Google and never link a calendar. Linking is view only (the one thing asked
// of Google is to see your events), the events are shown to you alone, and you can unlink any time, which also revokes Google's access.
export default function GoogleLinkPanel({ result, onChanged }: { result: string | null; onChanged: () => void }) {
  const [st, setSt] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try { const r = await fetch('/api/calendar/google', { cache: 'no-store' }); if (r.ok) setSt(await r.json()); else setError('Couldn’t load this.'); } catch { setError('Couldn’t reach the server.'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function setTitles(id: string, showTitles: boolean) {
    setBusy(true); setError('');
    const r = await fetch('/api/calendar/google', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, showTitles }) });
    setBusy(false);
    if (!r.ok) { setError('Couldn’t save that.'); return; }
    await load(); onChanged();
  }
  async function unlink(a: Account) {
    if (!(await confirmHold({ title: `Unlink ${a.email}?`, message: 'Its events stop showing here and in meeting planning, Google’s access for it is revoked, and nothing from that calendar is kept.', confirmLabel: 'Hold to unlink' }))) return;
    setBusy(true); setError('');
    const r = await fetch(`/api/calendar/google?id=${a.id}`, { method: 'DELETE' });
    setBusy(false);
    if (!r.ok) { setError('Couldn’t unlink. Try again.'); return; }
    await load(); onChanged();
  }

  const msg = result ? RESULT[result] : null;
  return (
    <section className={`${styles.subscribe} ${styles.googleCard}`} aria-label="Link my Google Calendar">
      <h3 className={styles.dayTitle}>Show my Google Calendar here</h3>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
      <ul className={styles.linkFacts}>
        <li><Lock size={13} aria-hidden="true" /> <span><b>View only.</b> We only ask to see your events. We can never add, change or delete anything in Google.</span></li>
        <li><Lock size={13} aria-hidden="true" /> <span><b>Only you see it.</b> Not officers, not other members, and never in the shared calendar link.</span></li>
        <li><Lock size={13} aria-hidden="true" /> <span><b>A hint when planning meetings.</b> Times you have something on show striped on your availability grid. They don’t block you: you still decide.</span></li>
        <li><Lock size={13} aria-hidden="true" /> <span><b>Separate from signing in.</b> Signing in with Google never links your calendar. This is your own choice, and you can unlink any time.</span></li>
      </ul>
      {st === null ? <p className={styles.muted}>Loading…</p> : !st.configured ? (
        <p className={styles.muted}>This isn’t set up on the site yet. An admin needs to add the Google Calendar credentials first.</p>
      ) : (
        <>
          {st.accounts.length > 0 && (
            <ul className={styles.accounts}>
              {st.accounts.map((a) => (
                <li key={a.id} className={styles.account}>
                  <div className={styles.accountTop}>
                    <span className={styles.accountEmail}><i className={styles.dotGoogle} aria-hidden="true" /> {a.email}</span>
                    <Button variant="danger" size="sm" onClick={() => unlink(a)} disabled={busy}><Link2Off size={14} aria-hidden="true" /> Unlink</Button>
                  </div>
                  {a.error && <Notice tone="warning">{a.error} <a className={styles.inlineLink} href="/api/calendar/google/connect">Link again</a></Notice>}
                  <label className={styles.linkToggle}>
                    <input type="checkbox" checked={a.showTitles} disabled={busy} onChange={(e) => setTitles(a.id, e.target.checked)} />
                    <span>Show event names (otherwise just “Busy”)</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          {st.accounts.length < st.max ? (
            <div className={styles.subRow}>
              <a className={styles.subBtn} href="/api/calendar/google/connect">{st.accounts.length ? 'Link another Google account' : 'Link my Google Calendar'}</a>
              {st.accounts.length > 0 && <span className={styles.muted}>Each account’s main calendar is shown. Pick a different account on Google’s screen.</span>}
            </div>
          ) : <p className={styles.muted}>You’ve linked the most accounts allowed ({st.max}).</p>}
        </>
      )}
    </section>
  );
}

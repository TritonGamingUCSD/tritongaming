'use client';

import { useCallback, useEffect, useState } from 'react';
import { Lock, MessageCircleQuestion, ShieldCheck, ShieldAlert, Ticket } from 'lucide-react';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import { countLabel } from '@/lib/strikeLabels';
import styles from './MyStrikes.module.css';

interface Strike { id: string; status: 'published' | 'removed'; mark: string | null; category: string; reason: string; incident_date: string; removed_how: 'taken' | 'voucher' | 'reset' | null; asked: boolean }
interface Voucher { id: string; reason: string | null; given_on: string; used_on: string | null; used_for: string | null; removed_on: string | null; removed_reason: string | null }
interface HistoryItem { id: string; kind: string; label: string | null; reason: string | null; on: string }
interface Summary { limit: number; active: number; atLimit: boolean; vouchers: number; strikes: Strike[]; voucherList: Voucher[]; history: HistoryItem[] }

const CATEGORY: Record<string, string> = { meeting: 'Missed meeting', event_shift: 'Missed event shift', deadline: 'Missed deadline or task', conduct: 'Conduct', other: 'Other' };
const EVENT: Record<string, string> = { strike_added: 'Strike added', strike_removed: 'Strike taken off', strike_reinstated: 'Strike put back', voucher_given: 'Voucher received', voucher_used: 'Voucher used', voucher_removed: 'Voucher removed', strikes_reset: 'Strikes reset' };
const day = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });

// Your own strikes and vouchers, in your Profile. Private: only you and HR can see it. It is calm by default: a plain count, the reasons, and a
// quiet way to ask HR about one.
export default function MyStrikes() {
  const [s, setS] = useState<Summary | null>(null);
  const [error, setError] = useState('');
  const [asking, setAsking] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    try { const r = await fetch('/api/strikes/mine', { cache: 'no-store' }); if (r.ok) setS(await r.json()); else setError('Couldn’t load this.'); } catch { setError('Couldn’t reach the server.'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function ask(id: string) {
    setBusy(true); setError(''); setNote('');
    const r = await fetch('/api/strikes/disputes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ strike_id: id, message }) });
    setBusy(false);
    if (!r.ok) { setError((await r.json().catch(() => ({}))).error || 'Couldn’t send that.'); return; }
    setAsking(null); setMessage(''); setNote('Sent. HR will look at it.'); await load();
  }

  if (error && !s) return <Notice tone="error">{error}</Notice>;
  if (!s) return <p className={styles.muted}>Loading…</p>;
  const tone = s.atLimit ? styles.bad : s.active >= 2 ? styles.warn : styles.ok;
  return (
    <section className={`${styles.wrap} ${tone}`} aria-label="Your strikes">
      <div className={styles.top}>
        <span className={styles.shield}>{s.active > 0 ? <ShieldAlert size={20} aria-hidden="true" /> : <ShieldCheck size={20} aria-hidden="true" />}</span>
        <div className={styles.title}><strong>{countLabel(s.active)}</strong><span><Lock size={11} aria-hidden="true" /> Only you and HR can see this</span></div>
        <span className={styles.pips} role="img" aria-label={countLabel(s.active)}>{Array.from({ length: s.limit }, (_, i) => <i key={i} className={i < s.active ? styles.on : ''} />)}</span>
      </div>
      {s.atLimit && <p className={styles.limit}>You’re at 3 strikes. The HR team will be contacting you.</p>}
      {error && <Notice tone="error">{error}</Notice>}
      {note && <Notice tone="success">{note}</Notice>}

      <h3 className={styles.h3}>Strikes</h3>
      {s.strikes.length === 0 ? <p className={styles.muted}>Nothing here. If a strike is ever added, it shows up here with the reason.</p> : (
        <ul className={styles.list}>
          {s.strikes.map((k) => (
            <li key={k.id} className={k.status === 'removed' ? styles.off : ''}>
              <div className={styles.row}>
                <span className={styles.cat}>{k.mark ? `${k.mark} · ` : ''}{CATEGORY[k.category] ?? 'Other'}</span>
                <time>{day(k.incident_date)}</time>
                {k.status === 'removed' && <em>{k.removed_how === 'voucher' ? 'Removed with a voucher' : k.removed_how === 'reset' ? 'Cleared by a reset' : 'Taken off'}</em>}
              </div>
              <p className={styles.reason}>{k.reason}</p>
              {k.status === 'published' && (k.asked ? <span className={styles.asked}><MessageCircleQuestion size={12} aria-hidden="true" /> You asked HR about this</span>
                : asking === k.id ? (
                  <form className={styles.ask} onSubmit={(e) => { e.preventDefault(); if (message.trim()) void ask(k.id); }}>
                    <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={500} rows={3} placeholder="What would you like HR to know or look at?" aria-label="Your question for HR" autoFocus />
                    <div className={styles.askActions}><Button type="button" size="sm" variant="ghost" onClick={() => { setAsking(null); setMessage(''); }}>Cancel</Button><Button type="submit" size="sm" loading={busy} disabled={!message.trim()}>Send to HR</Button></div>
                  </form>
                ) : <button type="button" className={styles.askLink} onClick={() => { setAsking(k.id); setMessage(''); setNote(''); }}>Ask HR about this</button>)}
            </li>
          ))}
        </ul>
      )}

      <h3 className={styles.h3}>Vouchers</h3>
      {s.voucherList.length === 0 ? <p className={styles.muted}>You have no vouchers. A voucher is used automatically the next time a strike is added.</p> : (
        <ul className={styles.vouchers}>
          {s.voucherList.map((v) => (
            <li key={v.id} className={v.used_on || v.removed_on ? styles.vUsed : ''}>
              <Ticket size={15} aria-hidden="true" />
              <span>
                <span><b>{v.removed_on ? 'Removed' : v.used_on ? 'Used' : 'Unused'}</b>{v.reason ? ` · ${v.reason}` : ''}</span>
                <small>Received {day(v.given_on)}{v.removed_on ? ` · removed ${day(v.removed_on)}${v.removed_reason ? ` · “${v.removed_reason}”` : ''}` : v.used_on ? ` · used ${day(v.used_on)}${v.used_for ? ` on “${v.used_for}”` : ''}` : ' · will be used automatically on your next strike'}</small>
              </span>
            </li>
          ))}
        </ul>
      )}

      {s.history.length > 0 && (<>
        <h3 className={styles.h3}>History</h3>
        <ul className={styles.vouchers}>
          {s.history.map((e) => <li key={e.id}><span><span><b>{e.kind === 'strike_added' && e.label ? `${e.label} added` : EVENT[e.kind] ?? e.kind}</b> · {day(e.on)}</span>{e.reason && <small>{e.reason}</small>}</span></li>)}
        </ul>
      </>)}
    </section>
  );
}

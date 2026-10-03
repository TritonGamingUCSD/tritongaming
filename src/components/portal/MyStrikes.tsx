'use client';

import { useCallback, useEffect, useState } from 'react';
import { Lock, ShieldCheck, ShieldAlert, Ticket } from 'lucide-react';
import Notice from '@/components/ui/Notice';
import { countLabel } from '@/lib/strikeLabels';
import styles from './MyStrikes.module.css';

interface Strike { id: string; status: 'published' | 'removed'; mark: string | null; category: string; reason: string; incident_date: string; removed_how: 'taken' | 'voucher' | 'reset' | null; removed_note: string | null }
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

  const load = useCallback(async () => {
    try { const r = await fetch('/api/strikes/mine', { cache: 'no-store' }); if (r.ok) setS(await r.json()); else setError('Couldn’t load this.'); } catch { setError('Couldn’t reach the server.'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (error && !s) return <Notice tone="error">{error}</Notice>;
  if (!s) return <p className={styles.muted}>Loading…</p>;
  const tone = s.atLimit ? styles.bad : s.active >= 1 ? styles.warn : styles.ok;
  const onRecord = s.strikes.filter((k) => k.status === 'published');
  const takenOff = s.strikes.filter((k) => k.status === 'removed');
  const vouchers = s.voucherList.filter((v) => !v.used_on);
  const spare = vouchers.filter((v) => !v.removed_on);
  return (
    <section className={`${styles.wrap} ${tone}`} aria-label="Your strikes">
      <div className={styles.top}>
        <span className={styles.shield}>{s.active > 0 ? <ShieldAlert size={20} aria-hidden="true" /> : <ShieldCheck size={20} aria-hidden="true" />}</span>
        <div className={styles.title}><strong>{countLabel(s.active)}</strong><span><Lock size={11} aria-hidden="true" /> Private: only you, exec and HR can see this</span></div>
        <span className={styles.pipsWrap} role="img" aria-label={countLabel(s.active)}>
          <span className={styles.pips}>
            <i className={`${styles.warnPip} ${s.active >= 1 ? styles.on : ''}`} />
            {Array.from({ length: s.limit - 1 }, (_, i) => <i key={i} className={i + 1 < s.active ? styles.on : ''} />)}
          </span>
        </span>
      </div>
      <p className={styles.how}>The first mark is a warning. After it, 3 strikes is the limit, and the HR team will contact you if you reach it.</p>
      {s.atLimit && <p className={styles.limit}>You’re at 3 strikes. The HR team will be contacting you.</p>}
      {error && <Notice tone="error">{error}</Notice>}

      <h3 className={styles.h3}>On your record</h3>
      {onRecord.length === 0 ? <p className={styles.muted}>Nothing. If a warning or strike is ever added, it shows up here with the reason.</p> : (
        <ul className={styles.list}>
          {onRecord.map((k) => (
            <li key={k.id} className={k.mark === 'Warning' ? styles.isWarning : ''}>
              <div className={styles.row}>
                {k.mark && <span className={styles.mark}>{k.mark}</span>}
                <span className={styles.cat}>{CATEGORY[k.category] ?? 'Other'}</span>
                <time>{day(k.incident_date)}</time>
              </div>
              <p className={styles.reason}>{k.reason}</p>
              <p className={styles.hint}>Questions about this? Message the HR team.</p>
            </li>
          ))}
        </ul>
      )}

      {takenOff.length > 0 && (<>
        <h3 className={styles.h3}>Taken off</h3>
        <ul className={styles.list}>
          {takenOff.map((k) => (
            <li key={k.id} className={styles.off}>
              <div className={styles.row}>
                <span className={styles.cat}>{CATEGORY[k.category] ?? 'Other'}</span>
                <time>{day(k.incident_date)}</time>
                <em>{k.removed_how === 'voucher' ? 'Removed with a voucher' : k.removed_how === 'reset' ? 'Cleared by a reset' : 'Taken off'}</em>
              </div>
              <p className={styles.reason}>{k.reason}</p>
              {k.removed_note && <p className={styles.why}>Why it came off: {k.removed_note}</p>}
            </li>
          ))}
        </ul>
      </>)}

      <h3 className={styles.h3}>Vouchers{spare.length > 0 ? ` · ${spare.length}` : ''}</h3>
      <p className={styles.muted}>A voucher removes your oldest warning or strike, once. It’s used automatically as soon as you have one to remove.</p>
      {vouchers.length > 0 && (
        <ul className={styles.vouchers}>
          {vouchers.map((v) => (
            <li key={v.id} className={v.removed_on ? styles.vUsed : ''}>
              <Ticket size={15} aria-hidden="true" />
              <span>
                <span><b>{v.removed_on ? 'Removed' : 'Waiting'}</b>{v.reason ? ` · ${v.reason}` : ''}</span>
                <small>Received {day(v.given_on)}{v.removed_on ? ` · removed ${day(v.removed_on)}${v.removed_reason ? ` · “${v.removed_reason}”` : ''}` : ''}</small>
              </span>
            </li>
          ))}
        </ul>
      )}

      {s.history.length > 0 && (
        <details className={styles.history}>
          <summary>Full history ({s.history.length})</summary>
          <ul className={styles.vouchers}>
            {s.history.map((e) => <li key={e.id}><span><span><b>{e.kind === 'strike_added' && e.label ? `${e.label} added` : EVENT[e.kind] ?? e.kind}</b> · {day(e.on)}</span>{e.reason && <small>{e.reason}</small>}</span></li>)}
          </ul>
        </details>
      )}
    </section>
  );
}

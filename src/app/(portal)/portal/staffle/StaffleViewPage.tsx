'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Check, Gift, Lock, Play, Presentation, Trophy } from 'lucide-react';
import Button from '@/components/ui/Button';
import IconButton from '@/components/ui/IconButton';
import Loading from '@/components/Loading/Loading';
import Notice from '@/components/ui/Notice';
import { RowMenu } from '../logistics/RowMenu';
import { confirmHold } from '@/lib/ui/confirmHold';
import { call, STATE_LABEL, type StaffleView } from './api';
import StaffleForm from './StaffleForm';
import StaffleItemsDialog from './StaffleItemsDialog';
import styles from './staffle.module.css';

// One Staffle: what it is, who it is open to, the prizes (tick the ones you want), and once drawn who won. People who run it also get the draw, claiming, drawing again and the edit menu.
export default function StaffleViewPage({ slug, canManage, onBack, onDraw, onGone }: { slug: string; canManage: boolean; onBack: () => void; onDraw: () => void; onGone: () => void }) {
  const [s, setS] = useState<StaffleView | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState('');
  const load = useCallback(async () => {
    const r = await call<{ staffle: StaffleView }>(`/api/staffle/${slug}`);
    if (r.ok) { setS(r.data.staffle); setError(''); } else setError(r.error);
  }, [slug]);
  useEffect(() => { void load(); const t = window.setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 20000); return () => window.clearInterval(t); }, [load]);   // counts follow what others enter
  const act = async (key: string, url: string, method: string, body?: unknown) => {
    setBusy(key); setError('');
    const r = await call<{ staffle: StaffleView }>(url, method, body);
    setBusy('');
    if (r.ok) setS(r.data.staffle); else setError(r.error);
    return r.ok;
  };
  if (!s) return <div className={styles.page}><button type="button" className={styles.back} onClick={onBack}><ArrowLeft size={15} aria-hidden="true" /> All Staffles</button>{error ? <Notice tone="error">{error}</Notice> : <Loading variant="inline" label="Loading…" />}</div>;
  const open = s.state === 'open', drawn = s.state === 'drawn' || s.state === 'ended';
  const remove = async () => {
    if (!(await confirmHold({ title: `Remove “${s.name}”?`, message: 'Its prizes, entries and winners are removed. The prizes go back to stock.', confirmLabel: 'Hold to remove' }))) return;
    const r = await call<{ ok: true }>(`/api/staffle/${s.slug}`, 'DELETE');
    if (r.ok) onGone(); else setError(r.error);
  };
  const over = s.state === 'ended';
  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <button type="button" className={styles.back} onClick={onBack} aria-label="All Staffles"><ArrowLeft size={15} aria-hidden="true" /> <span>All Staffles</span></button>
        <div className={styles.title}>
          <h2>{s.name}<span className={`${styles.chip} ${open ? styles.chipOn : ''}`}>{STATE_LABEL[s.state]}</span></h2>
          <p>{s.entrants} {s.entrants === 1 ? 'person has' : 'people have'} entered</p>
        </div>
        {canManage && !over && (
          <div className={styles.go}>
            {s.state === 'draft' && s.items.length > 0 && <Button loading={busy === 'open'} onClick={() => void act('open', `/api/staffle/${s.slug}`, 'PATCH', { status: 'open' })}><Play size={15} aria-hidden="true" /> Open Staffle</Button>}
            {s.state === 'open' && <Button variant="secondary" loading={busy === 'close'} onClick={() => void act('close', `/api/staffle/${s.slug}`, 'PATCH', { status: 'closed' })}><Lock size={15} aria-hidden="true" /> Close Entries</Button>}
            {s.state === 'closed' && <Button variant="secondary" loading={busy === 'open'} onClick={() => void act('open', `/api/staffle/${s.slug}`, 'PATCH', { status: 'open' })}><Play size={15} aria-hidden="true" /> Open Again</Button>}
            {(s.state === 'open' || s.state === 'closed') && <Button onClick={onDraw}><Presentation size={15} aria-hidden="true" /> Draw On The Big Screen</Button>}
            {s.state === 'drawn' && <Button variant="secondary" onClick={onDraw}><Presentation size={15} aria-hidden="true" /> Show The Draw Again</Button>}
            <IconButton kind="edit" label="Edit this Staffle" onClick={() => setEditing(true)} />
            <RowMenu label="More for this Staffle" items={[
              ...(s.state === 'drawn' ? [{ label: 'End Staffle (what was not claimed goes back)', onClick: () => void act('end', `/api/staffle/${s.slug}`, 'PATCH', { status: 'ended' }) }] : []),
              { label: 'Remove Staffle', danger: true, onClick: () => void remove() },
            ]} />
          </div>
        )}
        {canManage && over && <div className={styles.go}><RowMenu label="More for this Staffle" items={[{ label: 'Remove Staffle', danger: true, onClick: () => void remove() }]} /></div>}
      </div>
      {error && <div role="alert" onClick={() => setError('')}><Notice tone="error">{error}</Notice></div>}
      {s.me.won.length > 0 && (
        <div className={styles.winBanner}><Trophy size={20} aria-hidden="true" /><div><b>You won {s.me.won.map((w) => w.prize).join(', ')}!</b><span>{s.pickup_note}{s.me.won.every((w) => w.claimed) ? ' (Picked up.)' : ''}</span></div></div>
      )}
      <p className={styles.rules}>{s.rules_text}.{s.notes ? ` ${s.notes}` : ''}</p>
      {s.state === 'draft' && <Notice tone="info">{canManage ? (s.items.length ? 'Not open yet. Press Open Staffle when you are ready for people to enter.' : 'Not open yet. Pick its prizes first, then open it.') : 'This Staffle is not open yet.'}</Notice>}
      {!s.me.can_enter && open && <Notice tone="info">{s.me.why}</Notice>}
      {canManage && ['draft', 'open', 'closed'].includes(s.state) && (
        <div className={styles.prizesBar}><span>{s.items.length === 0 ? 'No prizes yet.' : `${s.items.length} ${s.items.length === 1 ? 'prize' : 'prizes'} to raffle.`}</span><Button variant="secondary" onClick={() => setPicking(true)}><Gift size={15} aria-hidden="true" /> {s.items.length ? 'Change Prizes' : 'Pick Prizes'}</Button></div>
      )}
      <ul className={styles.items}>
        {s.items.map((i) => {
          const live = i.won.filter((w) => !w.passed), passed = i.won.filter((w) => w.passed);
          const unclaimed = live.filter((w) => !w.claimed);
          return (
            <li key={i.id} className={`${styles.item} ${i.mine ? styles.itemMine : ''}`}>
              <div className={styles.itemPic}>{i.prize.photo ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={i.prize.photo} alt={i.prize.name} loading="lazy" /> : <Gift size={34} strokeWidth={1.4} aria-hidden="true" />}</div>
              <div className={styles.itemBody}>
                <b className={styles.itemName}>{i.prize.name}</b>
                <span className={styles.itemMeta}>{i.prize.sponsor ? `${i.prize.sponsor} · ` : ''}{i.winners} {i.winners === 1 ? 'winner' : 'winners'} · {i.entries} {i.entries === 1 ? 'entry' : 'entries'}</span>
                {open && (
                  <button type="button" className={`${styles.enter} ${i.mine ? styles.entered : ''}`} disabled={!s.me.can_enter || busy === i.id} aria-pressed={i.mine}
                    onClick={() => void act(i.id, `/api/staffle/${s.slug}/entries`, 'POST', { item_id: i.id, enter: !i.mine })}>
                    {i.mine ? <><Check size={15} aria-hidden="true" /> Entered</> : 'Enter'}
                  </button>
                )}
                {!open && !drawn && i.mine && <span className={styles.entered}><Check size={15} aria-hidden="true" /> You entered</span>}
                {drawn && (
                  <div className={styles.winners}>
                    {live.length === 0 && <span className={styles.nobody}>{i.entries === 0 ? 'Nobody entered' : 'No winner'}</span>}
                    {live.map((w) => (
                      <div key={w.id} className={`${styles.winner} ${w.claimed ? styles.claimed : ''}`}>
                        <Trophy size={13} aria-hidden="true" /><span>{w.name}</span>
                        {w.claimed && <em>picked up</em>}
                        {canManage && s.state === 'drawn' && (
                          <span className={styles.winnerTools}>
                            <button type="button" className={styles.mini} onClick={() => void act(w.id, `/api/staffle/${s.slug}/winners/${w.id}`, 'PATCH', { claimed: !w.claimed })}>{w.claimed ? 'Undo' : 'Mark Picked Up'}</button>
                            {!w.claimed && <button type="button" className={styles.mini} onClick={() => void act(w.id, `/api/staffle/${s.slug}/redraw`, 'POST', { winner_id: w.id })}>Draw Again</button>}
                          </span>
                        )}
                      </div>
                    ))}
                    {passed.length > 0 && <small className={styles.passed}>Passed over: {passed.map((w) => w.name).join(', ')}</small>}
                    {canManage && s.state === 'drawn' && unclaimed.length > 1 && <button type="button" className={styles.mini} onClick={() => void act(i.id, `/api/staffle/${s.slug}/redraw`, 'POST', { item_id: i.id })}>Draw Again For All Not Picked Up</button>}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {picking && <StaffleItemsDialog staffle={s} onClose={() => setPicking(false)} onSaved={() => { setPicking(false); void load(); }} />}
      {editing && <StaffleForm staffle={s} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); void load(); }} />}
    </div>
  );
}

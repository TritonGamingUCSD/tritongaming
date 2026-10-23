'use client';

import { RowMenu } from './RowMenu';
import { useMemo, useState } from 'react';
import Dialog, { DialogActions, DialogCancel } from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';
import { confirmHold } from '@/lib/ui/confirmHold';
import { stepCeiling, type PrizeStepDef } from '@/lib/logistics/prizes';
import { interactive } from './interactive';
import { usePrizes } from './usePrizes';
import type { PlanApi, PlanDetail } from './usePlans';
import styles from './logistics.module.css';

type Line = PlanDetail['prizes']['lines'][number];
type Pool = PlanDetail['prizes']['pools'][number];
const money = (n: number | null) => (n === null ? '' : `$${Number.isInteger(n) ? n : n.toFixed(2)}`);

// The prizes of one event: a block per pool (a raffle, a game's prizes, a scavenger hunt), a line per prize with how many it gets, and a box per step that is a COUNT (sorted 6 of 10): a small
// number taps up by one, a big one is typed. Red when more are promised than there are. The steps are shared by every pool and editable in Tools.
export default function PlanPrizes({ plan, canManage, closed }: { plan: PlanApi; canManage: boolean; closed: boolean }) {
  const d = plan.detail!;
  const { pools, lines, done, steps } = d.prizes;
  const manage = canManage && !closed;
  const [poolDialog, setPoolDialog] = useState<{ pool: Pool | null } | null>(null);
  const [adding, setAdding] = useState<Pool | null>(null);
  const [fold, setFold] = useState<Record<string, boolean>>({});
  const count = useMemo(() => new Map(done.map((x) => [`${x.line_id}:${x.step_id}`, x.done])), [done]);
  const stationName = (id: string | null) => d.stations.find((s) => s.id === id)?.name ?? null;
  if (!pools.length && !manage) return null;

  async function removePool(p: Pool) {
    if (!(await confirmHold({ title: `Remove ${p.name}?`, message: 'Its prize lines and their counts are removed from this plan. The prizes stay in the inventory.', confirmLabel: 'Hold to remove' }))) return;
    await plan.act('/pools', 'DELETE', { pool_id: p.id });
  }

  return (
    <section className={styles.prizeSection} aria-label="Prizes">
      <div className={styles.prizeHead}>
        <h3 className={styles.panelTitle}>Prizes <span className={styles.dim}>{lines.length} lines</span></h3>
        {manage && <Button size="sm" variant="secondary" onClick={() => setPoolDialog({ pool: null })}>Add Prize Pool</Button>}
      </div>
      {poolDialog && <PoolDialog plan={plan} pool={poolDialog.pool} onClose={() => setPoolDialog(null)} />}
      {adding && <AddPrizesDialog plan={plan} pool={adding} existing={new Set(lines.filter((l) => l.pool_id === adding.id).map((l) => l.prize_id))} onClose={() => setAdding(null)} />}
      {pools.length === 0 && <p className={styles.muted}>No prize pools yet. A pool is where prizes are given from at this event, like a raffle, a game, or a scavenger hunt.</p>}
      {pools.map((p) => {
        const mine = lines.filter((l) => l.pool_id === p.id);
        const total = mine.reduce((n, l) => n + l.quantity, 0);
        const givenIds = steps.filter((s) => s.gives).map((s) => s.id);
        const givenOf = (l: Line) => givenIds.reduce((n, id) => n + (count.get(`${l.id}:${id}`) ?? 0), 0);
        const stat = (s: PrizeStepDef) => {
          const tot = mine.reduce((n, l) => n + stepCeiling(s, l, givenOf(l)), 0);
          const dn = mine.reduce((n, l) => n + Math.min(count.get(`${l.id}:${s.id}`) ?? 0, stepCeiling(s, l, givenOf(l))), 0);
          return { tot, dn };
        };
        const finished = mine.length > 0 && steps.length > 0 && steps.every((s) => { const x = stat(s); return x.dn >= x.tot; });
        const folded = p.id in fold ? fold[p.id] : finished;
        const toggle = () => setFold((cur) => ({ ...cur, [p.id]: !folded }));
        const team = stationName(p.station_id);
        return (
          <section key={p.id} className={`${styles.dayTeam} ${finished ? styles.dayTeamDone : ''}`} style={{ '--n': steps.length } as React.CSSProperties} aria-label={p.name}>
            <div className={`${styles.dayRow} ${styles.dayRowHead} ${styles.clickRow}`} onClick={(e) => { if (!interactive(e.target)) toggle(); }}>
              <div className={styles.teamHeadMain}>
                <div className={styles.teamLine}>
                  <button type="button" className={styles.foldBtn} aria-expanded={!folded} onClick={toggle}>
                    <span className={styles.foldMark} aria-hidden="true">{folded ? '+' : '–'}</span>
                    <b>{p.name}</b>
                  </button>
                  <span className={finished ? styles.dTeamDone : styles.dTeamNum}>{finished ? 'All done' : `${total} prizes`}</span>
                </div>
                <div className={styles.teamLine}>
                  <span className={styles.dTeamSub}>{team ? `For ${team}` : 'Not linked to a team'}</span>
                  {manage && <RowMenu className={styles.teamMenu} label={`More for ${p.name}`} items={[{ label: 'Add Prizes', onClick: () => setAdding(p) }, { label: 'Rename Or Link To A Team', onClick: () => setPoolDialog({ pool: p }) }, { label: 'Remove Pool', danger: true, onClick: () => void removePool(p) }]} />}
                </div>
              </div>
              <div className={styles.dHeads}>
                {steps.map((s) => { const x = stat(s); return <span key={s.id} className={`${styles.dHead} ${x.tot > 0 && x.dn >= x.tot ? styles.dHeadDone : ''}`}><span>{s.name}</span><small>{x.dn}/{x.tot}</small></span>; })}
              </div>
            </div>
            {!folded && (mine.length === 0 ? <p className={styles.teamEmpty}>No prizes yet.{manage ? ' Use More, then Add Prizes.' : ''}</p> : mine.map((l) => (
              <PrizeLine key={l.id} line={l} steps={steps} count={count} given={givenOf(l)} plan={plan} manage={manage} closed={closed} />
            )))}
          </section>
        );
      })}
    </section>
  );
}

function PrizeLine({ line, steps, count, given, plan, manage, closed }: { line: Line; steps: PrizeStepDef[]; count: Map<string, number>; given: number; plan: PlanApi; manage: boolean; closed: boolean }) {
  const p = line.prize;
  const [editing, setEditing] = useState<string | null>(null);   // the step whose number is being typed
  const [qty, setQty] = useState<string | null>(null);
  const over = p.left < 0;
  async function saveQty() { const n = Math.round(Number(qty)); setQty(null); if (Number.isFinite(n) && n >= 1 && n !== line.quantity) await plan.act('/prizes', 'PATCH', { line_id: line.id, quantity: n }); }
  return (
    <div className={`${styles.dayRow} ${styles.dayLine} ${over ? styles.lineBad : ''}`}>
      <div className={styles.dInfo}>
        <b className={styles.dTag}>{p.name}</b>
        <span className={styles.dType}>{[p.sponsor, p.size, money(p.price) && `${money(p.price)} each`].filter(Boolean).join(' · ') || 'Club stock'}</span>
        <span className={styles.dWhere}>{p.left} left of {p.quantity_is_estimate ? '~' : ''}{p.quantity} in stock</span>
      </div>
      <div className={styles.dNotes}>
        {qty !== null ? (
          <input className={styles.qtyInput} type="number" min={1} max={100000} value={qty} autoFocus onChange={(e) => setQty(e.target.value)} onBlur={() => void saveQty()} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); else if (e.key === 'Escape') setQty(null); }} aria-label={`How many ${p.name}`} />
        ) : manage ? <button type="button" className={styles.qtyBtn} onClick={() => setQty(String(line.quantity))} title="Change how many">× {line.quantity} for this pool</button> : <span>× {line.quantity} for this pool</span>}
        {over && <span className={styles.flagBad}>{-p.left} more promised than there are</span>}
      </div>
      <div className={styles.dCells}>
        {steps.map((s) => {
          const ceiling = stepCeiling(s, line, given);
          const n = Math.min(count.get(`${line.id}:${s.id}`) ?? 0, ceiling);
          const full = ceiling > 0 && n >= ceiling;
          const label = `${p.name} · ${s.name}`;
          const set = (v: number) => void plan.setPrizeCount(line.id, s.id, Math.max(0, Math.min(ceiling, v)));
          if (ceiling === 0) return <span key={s.id} className={`${styles.cell} ${styles.cellNa}`} aria-hidden="true">–</span>;
          if (editing === s.id) {
            return (
              <span key={s.id} className={styles.cellWrap}>
                <input className={styles.qtyInput} type="number" min={0} max={ceiling} defaultValue={n} autoFocus aria-label={`${label}, out of ${ceiling}`} onBlur={(e) => { setEditing(null); if (Number(e.target.value) !== n) set(Number(e.target.value)); }} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); else if (e.key === 'Escape') setEditing(null); }} />
                <button type="button" className={styles.cellMinus} onMouseDown={(e) => e.preventDefault()} onClick={() => { setEditing(null); set(ceiling); }} aria-label={`All of ${label}`}>All</button>
              </span>
            );
          }
          const small = ceiling <= 12;
          const click = () => { if (closed) return; if (small) { if (full) set(0); else set(n + 1); } else setEditing(s.id); };
          return (
            <span key={s.id} className={styles.cellWrap}>
              <button type="button" className={`${styles.cell} ${full ? styles.cellDone : n > 0 ? styles.cellPart : ''}`} disabled={closed} onClick={click} aria-label={full ? `Undo ${label}` : `${label}: ${n} of ${ceiling}. ${small ? 'Add one' : 'Type a number'}`} title={small ? 'Tap to add one' : 'Tap to type a number'}>
                <span>{ceiling === 1 ? (full ? '✓' : <span className={styles.cellBox} />) : `${n}/${ceiling}`}</span>
                <span className={styles.cellLabel}>{s.name}</span>
              </button>
              {small && ceiling > 1 && n > 0 && !full && <button type="button" className={styles.cellMinus} disabled={closed} onClick={() => set(n - 1)} aria-label={`Take one off ${label}`}>−</button>}
            </span>
          );
        })}
      </div>
      <div className={styles.dTools}>
        {manage && <RowMenu label={`More for ${p.name}`} items={[{ label: 'Remove From Pool', danger: true, onClick: () => void plan.act('/prizes', 'DELETE', { line_id: line.id }) }]} />}
      </div>
    </div>
  );
}

export function PoolDialog({ plan, pool, onClose }: { plan: PlanApi; pool: Pool | null; onClose: () => void }) {
  const [name, setName] = useState(pool?.name ?? '');
  const [station, setStation] = useState(pool?.station_id ?? '');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!name.trim()) return;
    setBusy(true);
    const ok = pool ? await plan.act('/pools', 'PATCH', { pool_id: pool.id, name, station_id: station || null }) : await plan.act('/pools', 'POST', { name, station_id: station || null });
    setBusy(false);
    if (ok) onClose();
  };
  return (
    <Dialog title={pool ? 'Edit Prize Pool' : 'Add Prize Pool'} sheet busy={busy} onClose={onClose}>
      <div className={styles.form}>
        <Field label="Pool" hint="Where these prizes are given from, like ASUS Raffle, Smash, or Scavenger Hunt."><Input value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={80} /></Field>
        <Field label="Team" hint="Optional. Link it to one of this event’s teams."><Select value={station} onChange={(e) => setStation(e.target.value)}><option value="">Not linked</option>{plan.detail!.stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
      </div>
      <DialogActions>
        {pool && <Button variant="danger" onClick={async () => { if (!(await confirmHold({ title: `Remove ${pool.name}?`, message: 'Its prize numbers and counts are removed from this event. The prizes stay in the inventory.', confirmLabel: 'Hold to remove' }))) return; setBusy(true); const ok = await plan.act('/pools', 'DELETE', { pool_id: pool.id }); setBusy(false); if (ok) onClose(); }} disabled={busy}>Remove Pool</Button>}
        <DialogCancel onClick={onClose} disabled={busy} /><Button onClick={save} loading={busy} disabled={!name.trim()}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}

// Pick prizes from the inventory and say how many each pool gets; several at once.
function AddPrizesDialog({ plan, pool, existing, onClose }: { plan: PlanApi; pool: Pool; existing: Set<string>; onClose: () => void }) {
  const prizes = usePrizes();
  const [q, setQ] = useState('');
  const [qty, setQty] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const list = (prizes.rows ?? []).filter((p) => !existing.has(p.id) && `${p.name} ${p.event ?? ''}`.toLowerCase().includes(q.trim().toLowerCase()));
  const chosen = Object.entries(qty).map(([prize_id, v]) => ({ prize_id, quantity: Math.round(Number(v)) })).filter((x) => x.quantity >= 1);
  const save = async () => { setBusy(true); const ok = await plan.act('/prizes', 'POST', { pool_id: pool.id, items: chosen }); setBusy(false); if (ok) onClose(); };
  return (
    <Dialog title={`Add Prizes To ${pool.name}`} wide sheet busy={busy} onClose={onClose}>
      <div className={styles.form}>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search prizes" aria-label="Search prizes" autoFocus />
        {!prizes.rows ? <p className={styles.muted}>Loading…</p> : list.length === 0 ? <p className={styles.muted}>No prizes match.</p> : (
          <ul className={styles.pickPrizes}>
            {list.map((p) => (
              <li key={p.id} className={styles.pickPrize}>
                <span><b>{p.name}</b><span className={styles.dim}> {[p.size, money(p.price)].filter(Boolean).join(' · ')}</span></span>
                <span className={p.left < 0 ? styles.flagBad : styles.dim}>{p.left} left</span>
                <input className={styles.qtyInput} type="number" min={0} max={100000} placeholder="0" value={qty[p.id] ?? ''} onChange={(e) => setQty((c) => ({ ...c, [p.id]: e.target.value }))} aria-label={`How many ${p.name}`} />
              </li>
            ))}
          </ul>
        )}
      </div>
      <DialogActions><DialogCancel onClick={onClose} disabled={busy} /><Button onClick={save} loading={busy} disabled={chosen.length === 0}>Add {chosen.length || ''} Prize{chosen.length === 1 ? '' : 's'}</Button></DialogActions>
    </Dialog>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import { Input, Select } from '@/components/ui/Field';
import { PoolDialog } from './PlanPrizes';
import { NumberCell as EditNumber, PickCell } from './Cells';
import { usePrizes, type PrizeRow } from './usePrizes';
import type { PlanApi } from './usePlans';
import type { Catalog } from './useLogistics';
import styles from './logistics.module.css';

const money = (n: number | null) => (n === null ? '' : `$${n.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`);

// The allocation grid, like the old sheet: a row per prize (from storage, or sent by a sponsor for this event) with its price, how many there are and how many are LEFT, and a column per pool where you
// type how many that pool gets. Left is green while there is some, yellow at zero and red when more is promised than there is. Prize details stay pinned while the pools scroll sideways; on a phone each
// prize is a card that lists only the pools it is in.
export default function PrizeGrid({ plan, data }: { plan: PlanApi; data: Catalog }) {
  const d = plan.detail!;
  const prizes = usePrizes();
  const closed = d.plan.status === 'closed';
  const manage = d.canManage && !closed;
  const { pools, lines } = d.prizes;
  const [q, setQ] = useState('');
  const [sponsor, setSponsor] = useState('');
  const [size, setSize] = useState('');
  const [usedOnly, setUsedOnly] = useState(lines.length > 0);
  const [poolDialog, setPoolDialog] = useState<{ pool: (typeof pools)[number] | null } | null>(null);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const m = window.matchMedia('(max-width: 899px)');
    const sync = () => setNarrow(m.matches);
    sync(); m.addEventListener('change', sync);
    return () => m.removeEventListener('change', sync);
  }, []);
  const sponsorName = useMemo(() => new Map(data.sponsors.map((s) => [s.id, s.name])), [data.sponsors]);
  const qtyOf = useMemo(() => new Map(lines.map((l) => [`${l.pool_id}:${l.prize_id}`, l.quantity])), [lines]);
  const usedIds = useMemo(() => new Set(lines.map((l) => l.prize_id)), [lines]);
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (prizes.rows ?? []).filter((p) => (!p.plan_id || p.plan_id === d.plan.id) && (!usedOnly || usedIds.has(p.id))
      && (!t || `${p.name} ${sponsorName.get(p.sponsor_id ?? '') ?? ''}`.toLowerCase().includes(t))
      && (!sponsor || (sponsor === 'none' ? !p.sponsor_id : p.sponsor_id === sponsor)) && (!size || (size === 'none' ? !p.size : p.size === size)));
  }, [prizes.rows, d.plan.id, usedOnly, usedIds, q, sponsor, size, sponsorName]);
  const poolTotal = (poolId: string) => lines.filter((l) => l.pool_id === poolId).reduce((n, l) => n + l.quantity, 0);

  async function setNumber(poolId: string, p: PrizeRow, value: string) {
    const n = value.trim() === '' ? 0 : Math.round(Number(value));
    if (!Number.isFinite(n) || n < 0) return;
    const r = await plan.setPrizeLine(poolId, { id: p.id, name: p.name, sponsor: sponsorName.get(p.sponsor_id ?? '') ?? null, size: p.size, type: p.type, in_hand: p.in_hand, price: p.price, quantity: p.quantity, quantity_is_estimate: p.quantity_is_estimate, left: p.left }, n);
    if (r.ok && r.delta) prizes.bump(p.id, r.delta);
  }
  const leftClass = (n: number) => (n < 0 ? styles.leftBad : n === 0 ? styles.leftZero : styles.leftOk);

  return (
    <div className={styles.tab}>
      <div className={styles.toolbar}>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search prizes" aria-label="Search prizes" />
        <div className={styles.filters}>
          <Select value={sponsor} onChange={(e) => setSponsor(e.target.value)} aria-label="Sponsor"><option value="">All sponsors</option><option value="none">No sponsor (club)</option>{data.sponsors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
          <Select value={size} onChange={(e) => setSize(e.target.value)} aria-label="Size"><option value="">All sizes</option>{data.lists.prize_size.map((s) => <option key={s.id} value={s.value}>{s.value}</option>)}<option value="none">Big prizes</option></Select>
        </div>
        <div className={styles.toolbarRow}>
          <button type="button" className={`${styles.pill} ${usedOnly ? styles.pillOn : ''}`} aria-pressed={usedOnly} onClick={() => setUsedOnly((v) => !v)}>Only prizes used in this event</button>
          <span className={styles.count}>{rows.length} prizes · {pools.length} pools</span>
        </div>
      </div>
      {poolDialog && <PoolDialog plan={plan} pool={poolDialog.pool} onClose={() => setPoolDialog(null)} />}
      {!prizes.rows ? <p className={styles.muted}>Loading…</p> : pools.length === 0 ? (
        <div className={styles.empty}><p>{manage ? 'No pools yet. A pool is where prizes are given from at this event, like a raffle, a game, or a scavenger hunt. Add one, then type how many of each prize it gets.' : 'No prize pools have been set up for this event.'}</p></div>
      ) : rows.length === 0 ? <div className={styles.empty}><p>{usedOnly ? 'No prizes are used yet. Turn off “Only prizes used in this event” to pick some.' : 'No prizes match.'}</p></div> : narrow ? (
        <ul className={styles.gridCards}>
          {rows.map((p) => {
            const inPools = pools.filter((pl) => (qtyOf.get(`${pl.id}:${p.id}`) ?? 0) > 0);
            const free = pools.filter((pl) => !inPools.includes(pl));
            return (
              <li key={p.id} className={`${styles.gridCard} ${p.left < 0 ? styles.lineBad : ''}`}>
                <div className={styles.gridCardHead}><b>{p.name}</b><span className={`${styles.leftChip} ${leftClass(p.left)}`}>{p.left} left</span></div>
                <span className={styles.dim}>{[sponsorName.get(p.sponsor_id ?? '') ?? 'Club', money(p.price), `${p.quantity_is_estimate ? '~' : ''}${p.quantity} in stock`, p.plan_id ? 'Sponsor prize' : 'Storage'].filter(Boolean).join(' · ')}</span>
                {inPools.map((pl) => (
                  <label key={pl.id} className={styles.gridCardPool}><span>{pl.name}</span><EditNumber value={qtyOf.get(`${pl.id}:${p.id}`) || null} canEdit={manage} nullable label={`${p.name} for ${pl.name}`} onSave={(v) => void setNumber(pl.id, p, v === null ? '' : String(v))} /></label>
                ))}
                {manage && free.length > 0 && (
                  <PickCell value={null} options={free.map((pl) => pl.name)} canEdit clearable={false} shown="Add to a pool" onSave={(v) => { const pl = free.find((x) => x.name === v); if (pl) void setNumber(pl.id, p, '1'); }} />
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className={styles.matrixWrap}>
          <table className={styles.matrix}>
            <thead>
              <tr>
                <th className={`${styles.mPin} ${styles.mName}`}>Prize</th><th className={styles.mPin2}>Sponsor</th><th className={styles.mNum}>Price</th><th className={styles.mNum}>Total</th><th className={styles.mNum}>Left</th>
                {pools.map((pl) => (
                  <th key={pl.id} className={styles.mPool} scope="col">
                    {manage ? <button type="button" className={styles.poolHead} onClick={() => setPoolDialog({ pool: pl })} title="Rename, link to a team, or remove this pool">{pl.name}</button> : <span className={styles.poolHead}>{pl.name}</span>}
                    <small>{poolTotal(pl.id)} prizes{pl.station_id ? ` · ${d.stations.find((s) => s.id === pl.station_id)?.name ?? ''}` : ''}</small>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <th scope="row" className={`${styles.mPin} ${styles.mName}`}>{p.name}<small className={styles.dim}>{p.plan_id ? ' sponsor prize' : ''}</small></th>
                  <td className={styles.mPin2}>{sponsorName.get(p.sponsor_id ?? '') ?? <span className={styles.dim}>Club</span>}</td>
                  <td className={styles.mNum}>{money(p.price) || <span className={styles.dim}>–</span>}</td>
                  <td className={styles.mNum}>{p.quantity_is_estimate ? '~' : ''}{p.quantity}</td>
                  <td className={`${styles.mNum} ${styles.mLeft} ${leftClass(p.left)}`}>{p.left}</td>
                  {pools.map((pl) => {
                    const n = qtyOf.get(`${pl.id}:${p.id}`) ?? 0;
                    return <td key={pl.id} className={`${styles.mCell} ${n > 0 ? styles.mUsed : ''}`}><EditNumber value={n || null} canEdit={manage} nullable label={`${p.name} for ${pl.name}`} onSave={(v) => void setNumber(pl.id, p, v === null ? '' : String(v))} /></td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

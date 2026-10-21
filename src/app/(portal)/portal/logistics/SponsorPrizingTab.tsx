'use client';

import { useState } from 'react';
import Dialog from './Panel';
import { DialogActions, DialogCancel } from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { confirmHold } from '@/lib/ui/confirmHold';
import { Combo } from './Combo';
import { PrizeDialog } from './PrizesTab';
import { usePrizes, type PrizeRow } from './usePrizes';
import type { PlanApi } from './usePlans';
import type { Catalog, LogisticsApi } from './useLogistics';
import styles from './logistics.module.css';

const money = (n: number | null) => (n === null ? '' : `$${n.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`);
const pacificToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });

// Sponsor prizing: the prizes sponsors sent for this event. Unlike sponsor items they are never returned, and they are never given a device's place on the Allocation sheet: they are given out from
// the pools on the Prizing page. They are kept apart from the club's storage until the event is over; then what is left can be added to the storage (Inventory > Prizes).
export default function SponsorPrizingTab({ plan, api, data }: { plan: PlanApi; api: LogisticsApi; data: Catalog }) {
  const d = plan.detail!;
  const prizes = usePrizes();
  const closed = d.plan.status === 'closed';
  const manage = d.canManage && !closed;
  const ended = closed || d.plan.ends_on < pacificToday();
  const [dialog, setDialog] = useState<PrizeRow | 'new' | null>(null);
  const [storing, setStoring] = useState<PrizeRow[] | null>(null);
  const sponsorName = new Map(data.sponsors.map((s) => [s.id, s.name]));
  const sponsorOf = (p: PrizeRow) => sponsorName.get(p.sponsor_id ?? '') ?? 'Club';
  const mine = (prizes.rows ?? []).filter((p) => p.plan_id === d.plan.id).sort((a, b) => sponsorOf(a).localeCompare(sponsorOf(b), undefined, { sensitivity: 'base' }) || a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  const canStore = d.canManage && ended;
  const storable = mine.filter((p) => p.left > 0);

  return (
    <div className={styles.tab}>
      <section className={styles.prizeSection} aria-label="Sponsor prizes for this event">
        <div className={styles.prizeHead}>
          <h3 className={styles.panelTitle}>Sponsor Prizes For This Event <span className={styles.dim}>{mine.length}</span></h3>
          {manage && <Button size="sm" variant="secondary" onClick={() => setDialog('new')}>Add Sponsor Prize</Button>}
          {canStore && storable.length > 0 && <Button size="sm" onClick={() => setStoring(storable)}>Add {storable.length} To Storage</Button>}
        </div>
      {dialog && <PrizeDialog prizes={prizes} api={api} data={data} prize={dialog === 'new' ? null : dialog} where={{ plan: d.plan.id }} onClose={() => setDialog(null)} />}
      {storing && <StorageDialog prizes={prizes} api={api} data={data} list={storing} eventName={d.plan.name} onClose={() => setStoring(null)} />}
        {!prizes.rows ? <p className={styles.muted}>Loading…</p> : mine.length === 0 ? (
          <p className={styles.muted}>{manage ? 'No sponsor prizes yet. Add what sponsors sent for this event; it stays here until the event is over.' : 'No sponsor prizes for this event.'}</p>
        ) : (
          <div className={styles.prizeGrid}>
            <div className={`${styles.prizeRow} ${styles.prizeHeadRow} ${styles.sentRow}`} aria-hidden="true"><span>Sponsor</span><span>Prize</span><span>Size</span><span>Price</span><span>In stock</span><span>Promised</span><span>Given</span><span>Left</span><span /></div>
            {mine.map((p) => (
              <div key={p.id} className={`${styles.prizeRow} ${styles.sentRow} ${p.left < 0 ? styles.lineBad : ''}`}>
                <span className={styles.prizeName}><b>{sponsorOf(p)}</b></span>
                <span data-label="Prize">{p.name}</span>
                <span data-label="Size">{p.size ?? <span className={styles.dim}>Big</span>}</span>
                <span data-label="Price">{money(p.price) || <span className={styles.dim}>–</span>}</span>
                <span data-label="In stock">{p.quantity_is_estimate ? '~' : ''}{p.quantity}</span>
                <span data-label="Promised">{p.allocated}</span>
                <span data-label="Given">{p.given}</span>
                <span data-label="Left" className={p.left < 0 ? styles.flagBad : undefined}><b>{p.left}</b></span>
                <span className={styles.prizeTools}>
                  <button type="button" className={styles.linkBtn} onClick={() => setDialog(p)}>{d.canManage ? 'Edit' : 'Open'}</button>
                  {canStore && p.left > 0 && <button type="button" className={styles.linkBtn} onClick={() => setStoring([p])}>Add To Storage</button>}
                </span>
              </div>
            ))}
          </div>
        )}
        {canStore && mine.length > 0 && storable.length === 0 && <p className={styles.muted}>Nothing is left to add to storage.</p>}
        {!ended && mine.length > 0 && d.canManage && <p className={styles.muted}>Once the event is over you can add what is left to the club’s storage.</p>}
      </section>

    </div>
  );
}

// Add what is left of sponsor prizes to the club's storage: say where they are kept. They then show under Inventory > Prizes (the note says which event they came from).
function StorageDialog({ prizes, api, data, list, eventName, onClose }: { prizes: ReturnType<typeof usePrizes>; api: LogisticsApi; data: Catalog; list: PrizeRow[]; eventName: string; onClose: () => void }) {
  const [shelf, setShelf] = useState<string | null>(null);
  const [tier, setTier] = useState<string | null>(null);
  const [spot, setSpot] = useState('');
  const [busy, setBusy] = useState(false);
  const total = list.reduce((n, p) => n + p.left, 0);
  async function save() {
    if (!(await confirmHold({ title: `Add ${list.length === 1 ? list[0].name : `${list.length} prizes`} to storage?`, message: `What is left (${total}) is kept in the club’s storage and shows under Inventory > Prizes.`, confirmLabel: 'Hold to add' }))) return;
    setBusy(true);
    for (const p of list) await prizes.save(p.id, { plan_id: null, shelf, tier, place_note: spot || null, notes: [p.notes, `Sent for ${eventName}`].filter(Boolean).join('\n').slice(0, 2000) });
    setBusy(false);
    onClose();
  }
  return (
    <Dialog title="Add To Storage" busy={busy} onClose={onClose}>
      <div className={styles.form}>
        <p className={styles.muted}>{list.length === 1 ? `${list[0].name}: ${list[0].left} left.` : `${list.length} prizes, ${total} left in all.`} Where will {list.length === 1 ? 'it' : 'they'} be kept?</p>
        <div className={styles.row2}>
          <Field label="Shelf"><Combo value={shelf} options={data.lists.shelf.map((s) => s.value)} placeholder="Choose…" onChange={setShelf} onCreate={(v) => api.addOption('shelf', v)} /></Field>
          <Field label="Tier"><Combo value={tier} options={data.lists.tier.map((s) => s.value)} placeholder="Choose…" onChange={setTier} onCreate={(v) => api.addOption('tier', v)} /></Field>
        </div>
        <Field label="Exact spot" hint="Optional."><Input value={spot} onChange={(e) => setSpot(e.target.value)} maxLength={200} /></Field>
      </div>
      <DialogActions><DialogCancel onClick={onClose} disabled={busy} /><Button onClick={save} loading={busy}>Add To Storage</Button></DialogActions>
    </Dialog>
  );
}

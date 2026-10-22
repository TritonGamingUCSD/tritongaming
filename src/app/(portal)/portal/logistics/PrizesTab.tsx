'use client';

import { useMemo, useState } from 'react';
import Dialog, { DialogActions, DialogCancel } from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import Loading from '@/components/Loading/Loading';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { confirmHold } from '@/lib/ui/confirmHold';
import { Combo } from './Combo';
import PrizeEditRow from './PrizeEditRow';
import { usePrizes, type PrizeRow } from './usePrizes';
import type { Catalog, LogisticsApi } from './useLogistics';
import styles from './logistics.module.css';

const money = (n: number | null) => (n === null ? '' : `$${Number.isInteger(n) ? n.toLocaleString('en-US') : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const placeOf = (p: PrizeRow) => [p.shelf, p.tier, p.place_note].filter(Boolean).join(' · ');

// Prizes: everything that can be given out, club stock and sponsor gifts together. "Promised" is what open event plans hold for their pools, "Given" what has been handed out, "Left" what
// is still free to promise (red when more is promised than there is). A grid on a computer, a card per prize on a phone.
export default function PrizesTab({ api, data }: { api: LogisticsApi; data: Catalog }) {   // the club's storage: prizes sent for an event live under that event until it is over
  const prizes = usePrizes();
  const canEdit = data.canManage;
  const [q, setQ] = useState('');
  const [sponsor, setSponsor] = useState('');
  const [size, setSize] = useState('');
  const [problems, setProblems] = useState(false);
  const [dialog, setDialog] = useState<PrizeRow | 'new' | null>(null);
  const sponsorName = useMemo(() => new Map(data.sponsors.map((s) => [s.id, s.name])), [data.sponsors]);
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (prizes.rows ?? []).filter((p) => !p.plan_id && (!t || `${p.name} ${sponsorName.get(p.sponsor_id ?? '') ?? ''} ${placeOf(p)} ${p.notes ?? ''}`.toLowerCase().includes(t))
      && (!sponsor || (sponsor === 'none' ? !p.sponsor_id : p.sponsor_id === sponsor)) && (!size || (size === 'none' ? !p.size : p.size === size))
      && (!problems || p.left < 0));
  }, [prizes.rows, q, sponsor, size, problems, sponsorName]);
  const value = rows.reduce((n, p) => n + (p.price ?? 0) * Math.max(0, p.left), 0);

  return (
    <div className={styles.tab}>
      <div className={styles.toolbar}>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, sponsor or place" aria-label="Search prizes" />
        <div className={styles.filters}>
          <Select value={sponsor} onChange={(e) => setSponsor(e.target.value)} aria-label="Sponsor"><option value="">All sponsors</option><option value="none">No sponsor (club)</option>{data.sponsors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
          <Select value={size} onChange={(e) => setSize(e.target.value)} aria-label="Size"><option value="">All sizes</option>{data.lists.prize_size.map((s) => <option key={s.id} value={s.value}>{s.value}</option>)}<option value="none">Big prizes</option></Select>
        </div>
        <div className={styles.toolbarRow}>
          <button type="button" className={`${styles.pill} ${problems ? styles.pillOn : ''}`} aria-pressed={problems} onClick={() => setProblems((v) => !v)}>Over-promised</button>
          <span className={styles.count}>{rows.length} of {(prizes.rows ?? []).filter((p) => !p.plan_id).length} prizes in storage · {money(Math.round(value)) || '$0'} left in stock</span>
          {canEdit && <Button className={styles.addBtn} onClick={() => setDialog('new')}>Add Prize</Button>}
        </div>
      </div>
      {dialog && <PrizeDialog prizes={prizes} api={api} data={data} prize={dialog === 'new' ? null : dialog} where="storage" onClose={() => setDialog(null)} />}
      {prizes.error && <div role="alert" onClick={() => prizes.setError('')}><Notice tone="error">{prizes.error}</Notice></div>}
      {!prizes.rows ? (prizes.error ? null : <Loading variant="inline" label="Loading…" />) : prizes.rows.length === 0 ? (
        <div className={styles.empty}><p>{canEdit ? 'No prizes yet. Add the first one.' : 'No prizes have been added yet.'}</p></div>
      ) : rows.length === 0 ? <div className={styles.empty}><p>Nothing matches.</p></div> : (
        <div className={styles.prizeGrid}>
          <div className={`${styles.prizeRow} ${styles.prizeHeadRow}`} aria-hidden="true"><span>Prize</span><span>Sponsor</span><span>Size</span><span>Price</span><span>In stock</span><span>Promised</span><span>Given</span><span>Left</span><span>Where</span><span /></div>
          {rows.map((p) => <PrizeEditRow key={p.id} p={p} prizes={prizes} api={api} data={data} canEdit={canEdit} where rowClass={styles.prizeRow} onDetails={() => setDialog(p)} />)}
        </div>
      )}
    </div>
  );
}

// `where` fixes where the prize is: in club storage, or sent for one event (then it isn't asked).
export function PrizeDialog({ prizes, api, data, prize, where, onClose }: { prizes: ReturnType<typeof usePrizes>; api: LogisticsApi; data: Catalog; prize: PrizeRow | null; where: 'storage' | { plan: string }; onClose: () => void }) {
  const readOnly = !data.canManage;
  const [f, setF] = useState({
    name: prize?.name ?? '', sponsor_id: prize?.sponsor_id ?? '', size: prize?.size ?? '', price: prize?.price === null || prize?.price === undefined ? '' : String(prize.price),
    quantity: String(prize?.quantity ?? 1), estimate: prize?.quantity_is_estimate ?? false, shelf: prize?.shelf ?? null as string | null, tier: prize?.tier ?? null as string | null,
    place_note: prize?.place_note ?? '', plan_id: where === 'storage' ? '' : where.plan, expires_on: prize?.expires_on ?? '', notes: prize?.notes ?? '',
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((c) => ({ ...c, [k]: v }));
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const sponsorNames = data.sponsors.map((s) => s.name);
  const createOpt = (kind: 'shelf' | 'tier' | 'prize_size') => (v: string) => api.addOption(kind, v);
  async function save() {
    setProblem('');
    setBusy(true);
    const body = { name: f.name, sponsor_id: f.sponsor_id || null, size: f.size || null, price: f.price === '' ? null : Number(f.price), quantity: Number(f.quantity), quantity_is_estimate: f.estimate, shelf: f.shelf, tier: f.tier, place_note: f.place_note, plan_id: f.plan_id || null, expires_on: f.expires_on || null, notes: f.notes };
    const r = await prizes.save(prize?.id ?? null, body);
    setBusy(false);
    if (r) onClose(); else setProblem('That didn’t save. The message at the top of the page says why.');
  }
  async function remove() {
    if (!prize || !(await confirmHold({ title: `Remove ${prize.name}?`, message: 'It is taken out of the prize inventory.', confirmLabel: 'Hold to remove' }))) return;
    setBusy(true); const ok = await prizes.remove(prize.id); setBusy(false);
    if (ok) onClose(); else setProblem('It couldn’t be removed. The message at the top of the page says why.');
  }
  return (
    <Dialog title={prize ? (readOnly ? prize.name : 'Edit Prize') : 'Add Prize'} wide busy={busy} onClose={onClose}>
      <div className={styles.form}>
        {problem && <Notice tone="error">{problem}</Notice>}
        <Field label="Prize"><Input value={f.name} onChange={(e) => set('name', e.target.value)} disabled={readOnly} autoFocus maxLength={160} /></Field>
        <div className={styles.row2}>
          <Field label="Sponsor" hint="Leave empty for club-bought prizes.">
            <Combo value={data.sponsors.find((s) => s.id === f.sponsor_id)?.name ?? null} options={sponsorNames} disabled={readOnly} placeholder="Choose…"
              onChange={(v) => set('sponsor_id', data.sponsors.find((s) => s.name === v)?.id ?? '')}
              onCreate={async (v) => { const s = await api.saveSponsor(null, { name: v }); if (s) set('sponsor_id', s.id); return s?.name ?? null; }} />
          </Field>
          <Field label="Size"><Combo value={f.size || null} options={data.lists.prize_size.map((s) => s.value)} disabled={readOnly} placeholder="Big prize" onChange={(v) => set('size', v ?? '')} onCreate={createOpt('prize_size')} /></Field>
        </div>
        <div className={styles.row2}>
          <Field label="Price of one" hint="In dollars."><Input type="number" min={0} step="0.01" value={f.price} onChange={(e) => set('price', e.target.value)} disabled={readOnly} /></Field>
          <Field label="How many there are"><Input type="number" min={0} max={100000} value={f.quantity} onChange={(e) => set('quantity', e.target.value)} disabled={readOnly} /></Field>
        </div>
        <label className={styles.check}><input type="checkbox" checked={f.estimate} onChange={(e) => set('estimate', e.target.checked)} disabled={readOnly} /> That number is an estimate</label>
        {!f.plan_id && (
          <div className={styles.row2}>
            <Field label="Shelf"><Combo value={f.shelf} options={data.lists.shelf.map((s) => s.value)} disabled={readOnly} placeholder="Choose…" onChange={(v) => set('shelf', v)} onCreate={createOpt('shelf')} /></Field>
            <Field label="Tier"><Combo value={f.tier} options={data.lists.tier.map((s) => s.value)} disabled={readOnly} placeholder="Choose…" onChange={(v) => set('tier', v)} onCreate={createOpt('tier')} /></Field>
          </div>
        )}
        <div className={styles.row2}>
          <Field label="Exact spot" hint="Optional."><Input value={f.place_note} onChange={(e) => set('place_note', e.target.value)} disabled={readOnly} maxLength={200} /></Field>
          <Field label="Expires" hint="Optional."><Input type="date" value={f.expires_on} onChange={(e) => set('expires_on', e.target.value)} disabled={readOnly} /></Field>
        </div>
        <Field label="Notes"><Textarea rows={2} value={f.notes} onChange={(e) => set('notes', e.target.value)} disabled={readOnly} maxLength={2000} /></Field>
        {prize && <p className={styles.muted}>{prize.quantity} in stock · {prize.allocated} promised to open events · {prize.given} given out · <b>{prize.left} left</b></p>}
      </div>
      <DialogActions>
        {prize && !readOnly && <Button variant="danger" onClick={remove} disabled={busy}>Remove</Button>}
        <DialogCancel onClick={onClose} disabled={busy}>{readOnly ? 'Close' : 'Cancel'}</DialogCancel>
        {!readOnly && <Button onClick={save} loading={busy} disabled={!f.name.trim()}>Save</Button>}
      </DialogActions>
    </Dialog>
  );
}

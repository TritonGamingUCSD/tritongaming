'use client';

import { useEffect, useState } from 'react';
import Dialog, { DialogActions, DialogCancel, DialogText } from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import SectionTabs from '@/components/ui/SectionTabs';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { confirmHold } from '@/lib/ui/confirmHold';
import { Combo } from './Combo';
import ToolsTab from './ToolsTab';
import type { PrizesApi, PrizeRow } from './usePrizes';
import type { PlanApi, Station } from './usePlans';
import type { Catalog, LogisticsApi } from './useLogistics';
import styles from './logistics.module.css';
import pz from './prizing.module.css';

// ---- add or change a prize --------------------------------------------------------------------------------------------------------------------------------------------------------------
// Everything about one prize in one form. The number on hand is changed here too (with a reason, if you like): it is saved as a correction in the prize's history.
export function PrizeDialog({ prizes, api, data, prize, onClose }: { prizes: PrizesApi; api: LogisticsApi; data: Catalog; prize: PrizeRow | null; onClose: () => void }) {
  const readOnly = !data.canManage;
  const [f, setF] = useState({
    name: prize?.name ?? '', sponsor_id: prize?.sponsor_id ?? '', size: prize?.size ?? '', type: prize?.type ?? '', price: prize?.price === null || prize?.price === undefined ? '' : String(prize.price),
    quantity: String(prize?.quantity ?? 1), estimate: prize?.quantity_is_estimate ?? false, in_hand: prize?.in_hand ?? true, bin: prize?.bin ?? '', source: prize?.source ?? '',
    expires_on: prize?.expires_on ?? '', notes: prize?.notes ?? '', why: '',
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((c) => ({ ...c, [k]: v }));
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const sponsorNames = data.sponsors.map((s) => s.name);
  const createSize = (v: string) => api.addOption('prize_size', v);
  const quantity = Math.round(Number(f.quantity));
  const changedCount = !!prize && Number.isFinite(quantity) && quantity !== prize.quantity;
  async function save() {
    if (!f.size) { setProblem('Choose a size, so a request for that size can find this prize.'); return; }
    if (!Number.isFinite(quantity) || quantity < 0) { setProblem('How many are on hand has to be a whole number, 0 or more.'); return; }
    setProblem(''); setBusy(true);
    const body = { name: f.name, sponsor_id: f.sponsor_id || null, size: f.size || null, type: f.type || null, price: f.price === '' ? null : Number(f.price), quantity, quantity_is_estimate: f.estimate, in_hand: f.in_hand, bin: f.bin || null, source: f.source || null, expires_on: f.expires_on || null, notes: f.notes || null, note: f.why };
    const r = await prizes.save(prize?.id ?? null, body);
    setBusy(false);
    if (r) onClose(); else setProblem('That didn’t save. The message at the top of the page says why.');
  }
  async function remove() {
    if (!prize || !(await confirmHold({ title: `Remove ${prize.name}?`, message: 'It is taken out of the prize list, with its history.', confirmLabel: 'Hold to remove' }))) return;
    setBusy(true); const ok = await prizes.remove(prize.id); setBusy(false);
    if (ok) onClose(); else setProblem('It couldn’t be removed. The message at the top of the page says why.');
  }
  return (
    <Dialog title={prize ? prize.name : 'Add Prize'} wide sheet busy={busy} onClose={onClose}>
      <div className={styles.form}>
        {problem && <Notice tone="error">{problem}</Notice>}
        <Field label="Prize"><Input value={f.name} onChange={(e) => set('name', e.target.value)} disabled={readOnly} autoFocus={!prize} maxLength={160} /></Field>
        <div className={styles.row3}>
          <Field label="Sponsor" hint="Leave empty for club-bought prizes.">
            <Combo value={data.sponsors.find((s) => s.id === f.sponsor_id)?.name ?? null} options={sponsorNames} disabled={readOnly} placeholder="Choose…"
              onChange={(v) => set('sponsor_id', data.sponsors.find((s) => s.name === v)?.id ?? '')}
              onCreate={async (v) => { const s = await api.saveSponsor(null, { name: v }); if (s) set('sponsor_id', s.id); return s?.name ?? null; }} />
          </Field>
          <Field label="Type" hint="A mug, a gift card, a plushie…"><Input value={f.type} onChange={(e) => set('type', e.target.value)} disabled={readOnly} maxLength={80} /></Field>
          <Field label="Size"><Combo value={f.size || null} options={data.lists.prize_size.map((s) => s.value)} disabled={readOnly} placeholder="Choose a size" onChange={(v) => set('size', v ?? '')} onCreate={createSize} /></Field>
        </div>
        <div className={styles.row3}>
          <Field label="Price of one" hint="In dollars."><Input type="number" min={0} step="0.01" value={f.price} onChange={(e) => set('price', e.target.value)} disabled={readOnly} /></Field>
          <Field label="On hand" hint={prize ? 'Change it to correct a count.' : 'How many there are.'}><Input type="number" min={0} max={100000} value={f.quantity} onChange={(e) => set('quantity', e.target.value)} disabled={readOnly} /></Field>
          <Field label="Where it is" hint="A bin or box, like Blue bin 2."><Input value={f.bin} onChange={(e) => set('bin', e.target.value)} disabled={readOnly} maxLength={120} /></Field>
        </div>
        {changedCount && <Field label="Why the count changed" hint="Optional. It shows in the history."><Input value={f.why} onChange={(e) => set('why', e.target.value)} disabled={readOnly} maxLength={300} placeholder="Recount, damaged, found more…" /></Field>}
        {!prize && <Field label="Where it came from" hint="Optional: bought at Costco, sent by the sponsor for this event…"><Input value={f.source} onChange={(e) => set('source', e.target.value)} disabled={readOnly} maxLength={200} /></Field>}
        {prize && <Field label="Where it came from"><Input value={f.source} onChange={(e) => set('source', e.target.value)} disabled={readOnly} maxLength={200} /></Field>}
        <label className={styles.check}><input type="checkbox" checked={f.in_hand} onChange={(e) => set('in_hand', e.target.checked)} disabled={readOnly} /> It is here now (untick for a prize that is still on its way)</label>
        <label className={styles.check}><input type="checkbox" checked={f.estimate} onChange={(e) => set('estimate', e.target.checked)} disabled={readOnly} /> The number on hand is an estimate</label>
        <div className={styles.row2}>
          <Field label="Expires" hint="Optional."><Input type="date" value={f.expires_on} onChange={(e) => set('expires_on', e.target.value)} disabled={readOnly} /></Field>
        </div>
        <Field label="Notes"><Textarea rows={2} value={f.notes} onChange={(e) => set('notes', e.target.value)} disabled={readOnly} maxLength={2000} /></Field>
      </div>
      <DialogActions>
        {prize && !readOnly && <Button variant="danger" onClick={remove} disabled={busy}>Remove</Button>}
        <DialogCancel onClick={onClose} disabled={busy}>{readOnly ? 'Close' : 'Cancel'}</DialogCancel>
        {!readOnly && <Button onClick={save} loading={busy} disabled={!f.name.trim()}>Save</Button>}
      </DialogActions>
    </Dialog>
  );
}

// ---- a prize's history ---------------------------------------------------------------------------------------------------------------------------------------------------------------
interface LogEntry { id: string; kind: 'add' | 'correct' | 'assign' | 'give'; qty: number; plan_name: string | null; station: string | null; sponsor: string | null; note: string | null; by: string | null; at: string }
const KIND: Record<LogEntry['kind'], string> = { add: 'Added', correct: 'Count changed', assign: 'Promised', give: 'Given out' };
const when = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
export function HistoryDialog({ prize, onClose }: { prize: PrizeRow; onClose: () => void }) {
  const [log, setLog] = useState<LogEntry[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    void fetch(`/api/logistics/prizes/${prize.id}/log`, { cache: 'no-store' }).then((r) => r.json()).then((j) => { if (live) { if (j.log) setLog(j.log); else setError(j.error || 'Couldn’t load the history.'); } }).catch(() => { if (live) setError('Couldn’t reach the server.'); });
    return () => { live = false; };
  }, [prize.id]);
  return (
    <Dialog title={`${prize.name}: History`} wide sheet onClose={onClose}>
      <p className={styles.muted}>{prize.quantity} on hand · {prize.allocated} promised to open events · {prize.left} left to promise.</p>
      {error && <Notice tone="error">{error}</Notice>}
      {!log && !error && <p className={styles.muted}>Loading…</p>}
      {log && log.length === 0 && <p className={styles.muted}>Nothing recorded yet.</p>}
      {log && log.length > 0 && (
        <ul className={pz.history}>
          {log.map((e) => (
            <li key={e.id}>
              <span className={pz.hWhen}>{when(e.at)}</span>
              <b className={`${pz.hQty} ${e.kind === 'give' || e.qty < 0 ? pz.hMinus : ''}`}>{signed(e.qty)}</b>
              <span className={pz.hWhat}>{KIND[e.kind]}{e.station ? ` · ${e.station}` : ''}{e.plan_name ? ` · ${e.plan_name}` : ''}{e.sponsor ? ` · from ${e.sponsor}` : ''}{e.note ? ` — ${e.note}` : ''}</span>
              {e.by && <small className={pz.hBy}>{e.by}</small>}
            </li>
          ))}
        </ul>
      )}
      <DialogActions><DialogCancel onClick={onClose}>Close</DialogCancel></DialogActions>
    </Dialog>
  );
}

// ---- closing an event ------------------------------------------------------------------------------------------------------------------------------------------------------------------
// Closing takes out of stock what went out to the stations and was not counted back to storage. Lines that were never counted back are listed, and the person says what they mean.
export function CloseEventDialog({ name, lines, busy, onChoose, onClose }: { name: string; lines: { station: string; prize: string; quantity: number }[]; busy: boolean; onChoose: (how: 'returned' | 'given') => void; onClose: () => void }) {
  return (
    <Dialog title={`Close ${name}?`} wide sheet busy={busy} onClose={onClose}>
      <DialogText>These prizes were taken out to a station and never counted back to storage. What happened to them?</DialogText>
      <ul className={pz.history}>
        {lines.slice(0, 40).map((l, i) => <li key={i}><b className={pz.hQty}>{l.quantity}</b><span className={pz.hWhat}>{l.prize} · {l.station}</span></li>)}
        {lines.length > 40 && <li><span className={pz.hWhat}>…and {lines.length - 40} more</span></li>}
      </ul>
      <DialogActions>
        <DialogCancel onClick={onClose} disabled={busy} />
        <Button variant="secondary" onClick={() => onChoose('returned')} loading={busy}>They Came Back</Button>
        <Button onClick={() => onChoose('given')} loading={busy}>They Were Given Out</Button>
      </DialogActions>
    </Dialog>
  );
}

// ---- add a station -----------------------------------------------------------------------------------------------------------------------------------------------------------------------
// A station already in this event (a team with devices) that has no prizes yet, or a new one made only for prizes (a raffle, a scavenger hunt).
export function AddStationDialog({ plan, existing, onClose }: { plan: PlanApi; existing: Station[]; onClose: () => void }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const n = name.trim();
    if (!n) return;
    setBusy(true);
    const same = existing.find((s) => s.name.toLowerCase() === n.toLowerCase());
    const ok = same ? true : await plan.act('/stations', 'POST', { names: [n], prize_only: true });
    setBusy(false);
    if (ok) onClose();
  };
  return (
    <Dialog title="Add Station" busy={busy} onClose={onClose}>
      <div className={styles.form}>
        <Field label="Station" hint="A team, raffle, game or hunt. Pick one this event already has, or type a new one.">
          <Combo value={name || null} options={existing.map((s) => s.name)} placeholder="Choose or type a name" onChange={(v) => setName(v ?? '')} onCreate={async (v) => { setName(v); return v; }} />
        </Field>
      </div>
      <DialogActions><DialogCancel onClick={onClose} disabled={busy} /><Button onClick={save} loading={busy} disabled={!name.trim()}>Add</Button></DialogActions>
    </Dialog>
  );
}

// ---- the lists this page uses (the gear) -------------------------------------------------------------------------------------------------------------------------------------------
export function PrizingSettings({ api, data, onClose }: { api: LogisticsApi; data: Catalog; onClose: () => void }) {
  const [tab, setTab] = useState<'sponsors' | 'prizes'>('sponsors');
  return (
    <Dialog title="Prizing Settings" wide sheet onClose={onClose}>
      <SectionTabs<'sponsors' | 'prizes'> variant="segmented" label="Prizing settings" value={tab} onChange={setTab} tabs={[{ id: 'sponsors', label: 'Sponsors', count: data.sponsors.length }, { id: 'prizes', label: 'Sizes And Steps' }]} />
      <ToolsTab api={api} data={data} section={tab} />
      <DialogActions><DialogCancel onClick={onClose}>Done</DialogCancel></DialogActions>
    </Dialog>
  );
}

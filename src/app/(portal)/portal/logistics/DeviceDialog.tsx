'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, TriangleAlert, X } from 'lucide-react';
import Dialog from './Panel';
import { DialogActions, DialogCancel } from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import { Field, Input, Textarea, Select } from '@/components/ui/Field';
import { confirmHold } from '@/lib/ui/confirmHold';
import { CONDITIONS, DEFAULT_KIT } from '@/lib/logistics/constants';
import type { Device, KitLine } from '@/lib/logistics/devices';
import { Combo, MultiCombo } from './Combo';
import type { Catalog, LogisticsApi } from './useLogistics';
import styles from './logistics.module.css';

type Draft = Pick<Device, 'tag' | 'name' | 'type' | 'shelf' | 'tier' | 'place_note' | 'condition' | 'ports' | 'login' | 'games' | 'kit' | 'quantity' | 'quantity_is_estimate' | 'notes'>;

const blank = (): Draft => ({ tag: null, name: null, type: '', shelf: null, tier: null, place_note: null, condition: 'not_tested', ports: [], login: null, games: [], kit: [], quantity: null, quantity_is_estimate: true, notes: null });
const fromDevice = (d: Device): Draft => ({ tag: d.tag, name: d.name, type: d.type, shelf: d.shelf, tier: d.tier, place_note: d.place_note, condition: d.condition, ports: d.ports, login: d.login, games: d.games, kit: d.kit, quantity: d.quantity, quantity_is_estimate: d.quantity_is_estimate, notes: d.notes });
const kitFor = (type: string): KitLine[] => (DEFAULT_KIT[type] ?? []).map((item) => ({ item, qty: 1, missing: false }));
const when = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

// Add, edit, clone or just look at one device. Officers who can't edit see the same screen read-only (including the login, which every officer may see).
export default function DeviceDialog({ api, data, device, template, onClose, onClone }: { api: LogisticsApi; data: Catalog; device: Device | null; template?: Partial<Draft> | null; onClose: () => void; onClone?: (d: Draft) => void }) {
  const editing = !!device;
  const readOnly = !data.canManage;
  const [d, setD] = useState<Draft>(() => (device ? fromDevice(device) : { ...blank(), ...(template ?? {}) }));
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const [history, setHistory] = useState<{ id: string; at: string; summary: string; by: string | null }[] | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [pending, setPending] = useState(0);   // values being added to a list right now: saving waits for them
  const [kitTouched, setKitTouched] = useState(editing || (template?.kit?.length ?? 0) > 0);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((cur) => ({ ...cur, [k]: v }));
  const lists = data.lists;
  const typeInfo = lists.type.find((t) => t.value === d.type);
  const counted = !!typeInfo?.counted;
  const games = useMemo(() => [...new Set([...data.portalGames, ...lists.game.map((g) => g.value)])].sort((a, b) => a.localeCompare(b)), [data.portalGames, lists.game]);

  useEffect(() => {
    if (!showHistory || history || !device) return;
    void api.loadHistory(device.id).then((h) => setHistory(h ?? []));
  }, [showHistory, history, device, api]);

  function pickType(t: string | null) {
    setD((cur) => {
      const next = { ...cur, type: t ?? '' };
      // A new device starts with the parts that type usually comes with, until the kit has been touched.
      if (!editing && !kitTouched && t) next.kit = kitFor(t);
      return next;
    });
  }
  const waiting = async <T,>(job: Promise<T>): Promise<T> => { setPending((n) => n + 1); try { return await job; } finally { setPending((n) => n - 1); } };
  const createOpt = (kind: Parameters<LogisticsApi['addOption']>[0]) => (v: string) => waiting(api.addOption(kind, v));

  function patchOf(): Partial<Draft> {
    if (!device) return d;
    const base = fromDevice(device);
    return Object.fromEntries((Object.keys(d) as (keyof Draft)[]).filter((k) => JSON.stringify(d[k]) !== JSON.stringify(base[k])).map((k) => [k, d[k]])) as Partial<Draft>;
  }

  async function save(another: boolean) {
    setProblem('');
    if (!d.type) { setProblem('Pick what kind of device it is.'); return; }
    if (!counted && !d.tag?.trim()) { setProblem('Type the ID that is written on it (for example TECM1).'); return; }
    const patch = patchOf();
    if (editing && Object.keys(patch).length === 0) { onClose(); return; }
    setBusy(true);
    const saved = await api.saveDevice(device?.id ?? null, patch);
    setBusy(false);
    if (!saved) { setProblem('That didn’t save. The message at the top of the page says why.'); return; }
    if (another) {
      // Quick entry of a run of similar devices: keep where it goes and what it is, clear what is unique to each.
      setD({ ...d, tag: null, name: null, login: null, notes: null, kit: d.kit.map((k) => ({ ...k, missing: false })) });
      return;
    }
    onClose();
  }

  async function remove() {
    if (!device) return;
    if (!(await confirmHold({ title: `Remove ${device.tag ?? device.type}?`, message: 'It is taken out of the catalog and its history is deleted.', confirmLabel: 'Hold to remove' }))) return;
    setBusy(true);
    const ok = await api.removeDevice(device.id);
    setBusy(false);
    if (ok) onClose();
  }

  const setKit = (kit: KitLine[]) => { setKitTouched(true); set('kit', kit); };
  const title = readOnly ? (device?.tag ?? device?.type ?? 'Device') : editing ? `Edit ${device.tag ?? device.type}` : 'Add Device';

  return (
    <Dialog title={title} wide busy={busy} onClose={onClose}>
      <div className={styles.form}>
        {problem && <Notice tone="error">{problem}</Notice>}
        <div className={styles.row2}>
          <Field label={counted ? 'ID (optional)' : 'ID'} hint={counted ? 'Counted items don’t need one.' : 'As written on the device. TECM1 and “tecm 1” are the same.'}>
            <Input value={d.tag ?? ''} onChange={(e) => set('tag', e.target.value)} maxLength={40} disabled={readOnly} autoFocus={!editing && !readOnly} placeholder="TECM1" />
          </Field>
          <Field label="Name"><Input value={d.name ?? ''} onChange={(e) => set('name', e.target.value)} maxLength={120} disabled={readOnly} placeholder="Optional" /></Field>
        </div>
        <div className={styles.row2}>
          <Field label="Type"><Combo value={d.type || null} options={lists.type.map((t) => t.value)} onChange={pickType} onCreate={createOpt('type')} disabled={readOnly} clearable={false} placeholder="Choose a type…" /></Field>
          <Field label="Condition">
            <Select value={d.condition} onChange={(e) => set('condition', e.target.value as Draft['condition'])} disabled={readOnly}>
              {CONDITIONS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </Select>
          </Field>
        </div>
        <div className={styles.row3}>
          <Field label="Shelf"><Combo value={d.shelf} options={lists.shelf.map((s) => s.value)} onChange={(v) => set('shelf', v)} onCreate={createOpt('shelf')} disabled={readOnly} placeholder="Choose…" /></Field>
          <Field label="Tier"><Combo value={d.tier} options={lists.tier.map((s) => s.value)} onChange={(v) => set('tier', v)} onCreate={createOpt('tier')} disabled={readOnly} placeholder="Choose…" /></Field>
          <Field label="Exact spot"><Input value={d.place_note ?? ''} onChange={(e) => set('place_note', e.target.value)} maxLength={200} disabled={readOnly} placeholder="Left side, blue tub" /></Field>
        </div>

        {counted && (
          <div className={styles.row2}>
            <Field label="How many" hint="An estimate is fine.">
              <Input type="number" inputMode="numeric" min={0} value={d.quantity ?? ''} onChange={(e) => set('quantity', e.target.value === '' ? null : Math.max(0, Math.round(Number(e.target.value))))} disabled={readOnly} />
            </Field>
            <label className={styles.check}><input type="checkbox" checked={d.quantity_is_estimate} onChange={(e) => set('quantity_is_estimate', e.target.checked)} disabled={readOnly} /> This is an estimate (shown as “about”)</label>
          </div>
        )}

        <Field label="Ports and outputs"><MultiCombo values={d.ports} options={lists.port.map((p) => p.value)} onChange={(v) => set('ports', v)} onCreate={createOpt('port')} disabled={readOnly} placeholder="Add a port…" /></Field>
        <Field label="Games and software installed"><MultiCombo values={d.games} options={games} onChange={(v) => set('games', v)} onCreate={createOpt('game')} disabled={readOnly} placeholder="Add a game…" /></Field>

        <div className={styles.kitBlock}>
          <span className={styles.fieldLabel}>Kit: what goes with it</span>
          {d.kit.length === 0 && <p className={styles.muted}>Nothing listed.</p>}
          <ul className={styles.kitList}>
            {d.kit.map((k, i) => (
              <li key={k.item} className={`${styles.kitLine} ${k.missing ? styles.kitMissing : ''}`}>
                <span className={styles.kitName}>{k.item}</span>
                <input className={styles.kitQty} type="number" min={1} max={999} value={k.qty} aria-label={`Quantity of ${k.item}`} disabled={readOnly}
                  onChange={(e) => setKit(d.kit.map((x, j) => (j === i ? { ...x, qty: Math.max(1, Math.round(Number(e.target.value)) || 1) } : x)))} />
                <button type="button" className={`${styles.missBtn} ${k.missing ? styles.missOn : ''}`} disabled={readOnly} aria-pressed={k.missing}
                  onClick={() => setKit(d.kit.map((x, j) => (j === i ? { ...x, missing: !x.missing } : x)))}>{k.missing ? <><TriangleAlert size={13} aria-hidden="true" /> Missing</> : 'Present'}</button>
                {!readOnly && <button type="button" className={styles.iconBtn} aria-label={`Remove ${k.item}`} onClick={() => setKit(d.kit.filter((_, j) => j !== i))}><X size={14} aria-hidden="true" /></button>}
              </li>
            ))}
          </ul>
          {!readOnly && (
            <Combo value={null} options={lists.kit.map((k) => k.value).filter((v) => !d.kit.some((x) => x.item.toLowerCase() === v.toLowerCase()))} clearable={false} placeholder="Add a part…"
              onChange={(v) => v && setKit([...d.kit, { item: v, qty: 1, missing: false }])} onCreate={createOpt('kit')} />
          )}
        </div>

        <Field label="Login" hint="Every officer can see this."><Input value={d.login ?? ''} onChange={(e) => set('login', e.target.value)} maxLength={200} disabled={readOnly} autoComplete="off" /></Field>
        <Field label="Notes" hint="Quirks, warnings, maintenance."><Textarea rows={3} value={d.notes ?? ''} onChange={(e) => set('notes', e.target.value)} maxLength={2000} disabled={readOnly} /></Field>

        {editing && (
          <div>
            <button type="button" className={styles.linkBtn} onClick={() => setShowHistory((v) => !v)}>{showHistory ? 'Hide History' : 'Show History'}</button>
            {showHistory && (history === null ? <p className={styles.muted}>Loading…</p> : history.length === 0 ? <p className={styles.muted}>Nothing recorded yet.</p> : (
              <ul className={styles.history}>{history.map((h) => <li key={h.id}><span>{h.summary}</span><small>{when(h.at)}{h.by ? ` · ${h.by}` : ''}</small></li>)}</ul>
            ))}
          </div>
        )}
      </div>
      <div className={styles.stickyFoot}>
        <DialogActions>
          <DialogCancel onClick={onClose} disabled={busy}>{readOnly ? 'Close' : 'Cancel'}</DialogCancel>
          {!readOnly && <Button onClick={() => save(false)} loading={busy} disabled={pending > 0}>{editing ? 'Save' : 'Add'}</Button>}
        </DialogActions>
        {!readOnly && (
          <div className={styles.dialogExtra}>
            {!editing && <Button variant="secondary" size="sm" onClick={() => save(true)} disabled={busy || pending > 0}><Plus size={14} aria-hidden="true" /> Save And Add Another</Button>}
            {editing && onClone && <Button variant="secondary" size="sm" onClick={() => onClone({ ...d, tag: null })} disabled={busy}>Clone As New</Button>}
            {editing && <Button variant="danger" size="sm" onClick={remove} disabled={busy}>Remove</Button>}
          </div>
        )}
      </div>
    </Dialog>
  );
}

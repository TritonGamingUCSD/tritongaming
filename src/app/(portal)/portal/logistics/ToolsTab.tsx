'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Input } from '@/components/ui/Field';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { APPLIES_LABELS, type Applies } from '@/lib/logistics/plans';
import { KIND_HINTS, KIND_LABELS, LIST_KINDS, type OptionKind } from '@/lib/logistics/constants';
import type { Catalog, LogisticsApi, OptionItem } from './useLogistics';
import styles from './logistics.module.css';

// Tools: the dropdown lists used everywhere in Logistics. Rename a value and everything that uses it follows; a value that is in use can't be deleted until those devices are changed.
export default function ToolsTab({ api, data }: { api: LogisticsApi; data: Catalog }) {
  return (
    <div className={styles.tab}>
      <p className={styles.muted}>These lists fill the dropdowns. You can also add a value while picking one on a device.</p>
      <div className={styles.listGrid}>
        <StepsEditor api={api} items={data.lists.step} />
        <BundlesEditor api={api} items={data.lists.bundle} types={data.lists.type.map((t) => t.value)} />
        {LIST_KINDS.map((kind) => <ListEditor key={kind} kind={kind} api={api} items={data.lists[kind]} extra={kind === 'game' ? `${data.portalGames.length} games from the portal’s own list are always included.` : undefined} />)}
      </div>
    </div>
  );
}

function ListEditor({ kind, items, api, extra }: { kind: OptionKind; items: OptionItem[]; api: LogisticsApi; extra?: string }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  async function add() {
    const v = text.trim();
    if (!v) return;
    setBusy(true);
    const made = await api.addOption(kind, v);
    setBusy(false);
    if (made !== null) setText('');
  }
  return (
    <section className={styles.listCard} aria-label={KIND_LABELS[kind]}>
      <h3 className={styles.listTitle}>{KIND_LABELS[kind]} <span className={styles.dim}>{items.length}</span></h3>
      <p className={styles.listHint}>{KIND_HINTS[kind]}{extra ? ` ${extra}` : ''}</p>
      <ul className={styles.listRows}>
        {items.map((o) => <OptionRow key={o.id} kind={kind} o={o} api={api} />)}
      </ul>
      <div className={styles.addRow}>
        <Input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void add(); }} maxLength={80} placeholder="Add a value" aria-label={`Add to ${KIND_LABELS[kind]}`} disabled={busy} />
        <button type="button" className={styles.iconBtn} onClick={add} disabled={busy || !text.trim()} aria-label="Add"><Plus size={15} aria-hidden="true" /></button>
      </div>
    </section>
  );
}

function OptionRow({ kind, o, api }: { kind: OptionKind; o: OptionItem; api: LogisticsApi }) {
  const [name, setName] = useState(o.value);
  const rename = async () => {
    const v = name.trim();
    if (!v || v === o.value) { setName(o.value); return; }
    if (!(await api.changeOption(o.id, { value: v }))) setName(o.value);
  };
  return (
    <li className={styles.optRow}>
      <input className={styles.optInput} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} onBlur={rename} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} aria-label={`Rename ${o.value}`} />
      {kind === 'type' && (
        <label className={styles.countedBox} title="Counted: one row with an estimated quantity instead of one row per item">
          <input type="checkbox" checked={!!o.counted} onChange={(e) => void api.changeOption(o.id, { counted: e.target.checked })} /> Counted
        </label>
      )}
      <button type="button" className={styles.iconBtn} aria-label={`Delete ${o.value}`} onClick={() => void api.deleteOption(kind, o.id)}><X size={14} aria-hidden="true" /></button>
    </li>
  );
}

// The steps every device goes through on event day, in order. "For" says which devices a step is for; "Review parts" shows the device's parts to tick present or missing at that step.
function StepsEditor({ api, items }: { api: LogisticsApi; items: OptionItem[] }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  async function add() { const v = text.trim(); if (!v) return; setBusy(true); const made = await api.addOption('step', v, { applies: 'all' }); setBusy(false); if (made !== null) setText(''); }
  return (
    <section className={`${styles.listCard} ${styles.listWide}`} aria-label={KIND_LABELS.step}>
      <h3 className={styles.listTitle}>{KIND_LABELS.step} <span className={styles.dim}>{items.length}</span></h3>
      <p className={styles.listHint}>{KIND_HINTS.step} “Back to Storage” is for club devices; “Returned to owner” is for sponsor and loaner devices.</p>
      <ul className={styles.listRows}>
        {items.map((o, i) => <StepRow key={o.id} o={o} first={i === 0} last={i === items.length - 1} api={api} />)}
      </ul>
      <div className={styles.addRow}>
        <Input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void add(); }} maxLength={80} placeholder="Add a step" aria-label="Add a step" disabled={busy} />
        <button type="button" className={styles.iconBtn} onClick={add} disabled={busy || !text.trim()} aria-label="Add"><Plus size={15} aria-hidden="true" /></button>
      </div>
    </section>
  );
}

function StepRow({ o, first, last, api }: { o: OptionItem; first: boolean; last: boolean; api: LogisticsApi }) {
  const [name, setName] = useState(o.value);
  const rename = async () => { const v = name.trim(); if (!v || v === o.value) { setName(o.value); return; } if (!(await api.changeOption(o.id, { value: v }))) setName(o.value); };
  return (
    <li className={styles.stepRow}>
      <div className={styles.stepMove}>
        <button type="button" className={styles.iconBtn} aria-label={`Move ${o.value} up`} disabled={first} onClick={() => void api.changeOption(o.id, { move: 'up' })}><ArrowUp size={14} aria-hidden="true" /></button>
        <button type="button" className={styles.iconBtn} aria-label={`Move ${o.value} down`} disabled={last} onClick={() => void api.changeOption(o.id, { move: 'down' })}><ArrowDown size={14} aria-hidden="true" /></button>
      </div>
      <input className={styles.optInput} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} onBlur={rename} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} aria-label={`Rename ${o.value}`} />
      <select className={styles.miniSelect} aria-label={`${o.value} is for`} value={o.applies ?? 'all'} onChange={(e) => void api.changeOption(o.id, { applies: e.target.value })}>
        {(Object.keys(APPLIES_LABELS) as Applies[]).map((a) => <option key={a} value={a}>{APPLIES_LABELS[a]}</option>)}
      </select>
      <label className={styles.countedBox}><input type="checkbox" checked={!!o.kit} onChange={(e) => void api.changeOption(o.id, { kit: e.target.checked })} /> Review parts</label>
      <button type="button" className={styles.iconBtn} aria-label={`Delete ${o.value}`} onClick={() => void api.deleteOption('step', o.id)}><X size={14} aria-hidden="true" /></button>
    </li>
  );
}

// Bundles: a named set of device types that go together ("PC Station" = a PC with its monitor, keyboard, mouse and headset). Choosing a bundle for a plan makes a station with a full set for each.
function BundlesEditor({ api, items, types }: { api: LogisticsApi; items: OptionItem[]; types: string[] }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  async function add() { const v = text.trim(); if (!v || !types.length) return; setBusy(true); const made = await api.addOption('bundle', v, { items: [{ type: types[0], qty: 1 }] }); setBusy(false); if (made !== null) setText(''); }
  return (
    <section className={`${styles.listCard} ${styles.listWide}`} aria-label={KIND_LABELS.bundle}>
      <h3 className={styles.listTitle}>{KIND_LABELS.bundle} <span className={styles.dim}>{items.length}</span></h3>
      <p className={styles.listHint}>{KIND_HINTS.bundle}</p>
      <ul className={styles.bundleList}>{items.map((o) => <BundleCard key={o.id} o={o} api={api} types={types} />)}</ul>
      <div className={styles.addRow}>
        <Input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void add(); }} maxLength={80} placeholder="Add a bundle" aria-label="Add a bundle" disabled={busy} />
        <button type="button" className={styles.iconBtn} onClick={add} disabled={busy || !text.trim()} aria-label="Add"><Plus size={15} aria-hidden="true" /></button>
      </div>
    </section>
  );
}

function BundleCard({ o, api, types }: { o: OptionItem; api: LogisticsApi; types: string[] }) {
  const [name, setName] = useState(o.value);
  const list = o.items ?? [];
  const rename = async () => { const v = name.trim(); if (!v || v === o.value) { setName(o.value); return; } if (!(await api.changeOption(o.id, { value: v }))) setName(o.value); };
  const save = (items: { type: string; qty: number }[]) => { if (items.length) void api.changeOption(o.id, { items }); };
  return (
    <li className={styles.bundleCard}>
      <div className={styles.optRow}>
        <input className={styles.optInput} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} onBlur={rename} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} aria-label={`Rename ${o.value}`} />
        <button type="button" className={styles.iconBtn} aria-label={`Delete ${o.value}`} onClick={() => void api.deleteOption('bundle', o.id)}><X size={14} aria-hidden="true" /></button>
      </div>
      <ul className={styles.bundleItems}>
        {list.map((it, i) => (
          <li key={i} className={styles.optRow}>
            <input className={styles.kitQty} type="number" min={1} max={20} value={it.qty} aria-label={`How many ${it.type}`} onChange={(e) => save(list.map((x, j) => (j === i ? { ...x, qty: Math.min(20, Math.max(1, Math.round(Number(e.target.value)) || 1)) } : x)))} />
            <select className={styles.miniSelect} aria-label="Device type" value={it.type} onChange={(e) => save(list.map((x, j) => (j === i ? { ...x, type: e.target.value } : x)))}>{types.map((t) => <option key={t} value={t}>{t}</option>)}</select>
            <button type="button" className={styles.iconBtn} aria-label={`Remove ${it.type}`} disabled={list.length <= 1} onClick={() => save(list.filter((_, j) => j !== i))}><X size={14} aria-hidden="true" /></button>
          </li>
        ))}
      </ul>
      <select className={styles.miniSelect} aria-label={`Add to ${o.value}`} value="" onChange={(e) => { if (e.target.value) save([...list, { type: e.target.value, qty: 1 }]); }}>
        <option value="">Add a device type…</option>{types.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
    </li>
  );
}

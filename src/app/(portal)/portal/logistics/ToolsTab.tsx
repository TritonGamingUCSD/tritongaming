'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Input } from '@/components/ui/Field';
import { KIND_HINTS, KIND_LABELS, OPTION_KINDS, type OptionKind } from '@/lib/logistics/constants';
import type { Catalog, LogisticsApi, OptionItem } from './useLogistics';
import styles from './logistics.module.css';

// Tools: the dropdown lists used everywhere in Logistics. Rename a value and everything that uses it follows; a value that is in use can't be deleted until those devices are changed.
export default function ToolsTab({ api, data }: { api: LogisticsApi; data: Catalog }) {
  return (
    <div className={styles.tab}>
      <p className={styles.muted}>These lists fill the dropdowns. You can also add a value while picking one on a device.</p>
      <div className={styles.listGrid}>
        {OPTION_KINDS.map((kind) => <ListEditor key={kind} kind={kind} api={api} items={data.lists[kind]} extra={kind === 'game' ? `${data.portalGames.length} games from the portal’s own list are always included.` : undefined} />)}
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

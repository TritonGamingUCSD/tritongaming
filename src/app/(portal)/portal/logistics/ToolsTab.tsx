'use client';

import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import Button from '@/components/ui/Button';
import PhoneFold from '@/components/ui/PhoneFold';
import { Input } from '@/components/ui/Field';
import { APPLIES_LABELS, type Applies } from '@/lib/logistics/plans';
import { KIND_HINTS, KIND_LABELS, type OptionKind } from '@/lib/logistics/constants';
import SponsorsTab from './SponsorsTab';
import { NumberCell, PickCell, TextCell } from './Cells';
import { RowMenu } from './RowMenu';
import { usePrizes } from './usePrizes';
import type { ToolsSection } from './logisticsRoute';
import type { Catalog, LogisticsApi, OptionItem } from './useLogistics';
import styles from './logistics.module.css';

// How many devices (or prizes) use each value of a list, so a value that is in use says so and its Delete is off until those are changed.
function useUsage(data: Catalog, prizeSizes: (string | null)[] | null): Record<string, Map<string, number>> {
  return useMemo(() => {
    const out: Record<string, Map<string, number>> = { type: new Map(), shelf: new Map(), tier: new Map(), port: new Map(), game: new Map(), kit: new Map(), prize_size: new Map() };
    const bump = (k: string, v: string | null | undefined) => { if (v) out[k].set(v, (out[k].get(v) ?? 0) + 1); };
    for (const d of data.devices) { bump('type', d.type); bump('shelf', d.shelf); bump('tier', d.tier); d.ports.forEach((p) => bump('port', p)); d.games.forEach((g) => bump('game', g)); d.kit.forEach((k) => bump('kit', k.item)); }
    (prizeSizes ?? []).forEach((v) => bump('prize_size', v));
    return out;
  }, [data.devices, prizeSizes]);
}

// Tools: the dropdown lists used everywhere in Logistics. Rename a value and everything that uses it follows; a value that is in use can't be deleted until those devices are changed.
export default function ToolsTab({ api, data, section }: { api: LogisticsApi; data: Catalog; section: ToolsSection }) {
  const prizes = usePrizes();
  const usage = useUsage(data, prizes.rows ? prizes.rows.map((p) => p.size) : null);
  if (section === 'sponsors') return <SponsorsTab api={api} data={data} />;
  const canEdit = data.canManage;
  return (
    <div className={styles.tab}>
      <div className={styles.listGrid}>
        {section === 'event-steps' && <StepsEditor api={api} items={data.lists.step} kind="step" canEdit={canEdit} />}
        {section === 'bundles' && <BundlesEditor api={api} items={data.lists.bundle} types={data.lists.type.map((t) => t.value)} canEdit={canEdit} />}
        {section === 'prizes' && <><StepsEditor api={api} items={data.lists.prize_step} kind="prize_step" canEdit={canEdit} /><ListEditor kind="prize_size" api={api} items={data.lists.prize_size} usage={prizes.rows ? usage.prize_size : null} unit="prize" canEdit={canEdit} /></>}
        {section === 'lists' && (['type', 'shelf', 'tier', 'port', 'game', 'kit'] as const).map((kind) => <ListEditor key={kind} kind={kind} api={api} items={data.lists[kind]} usage={usage[kind]} unit="device" canEdit={canEdit} extra={kind === 'game' ? `${data.portalGames.length} games from the portal’s own list are always included.` : undefined} />)}
      </div>
    </div>
  );
}

// The add box at the foot of a list: type a value, press Enter or Add.
function AddRow({ placeholder, label, onAdd }: { placeholder: string; label: string; onAdd: (v: string) => Promise<boolean> }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  async function add() {
    const v = text.trim();
    if (!v) return;
    setBusy(true);
    const ok = await onAdd(v);
    setBusy(false);
    if (ok) setText('');
  }
  return (
    <div className={styles.addRow}>
      <Input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void add(); }} maxLength={80} placeholder={placeholder} aria-label={label} disabled={busy} />
      <Button size="sm" onClick={() => void add()} loading={busy} disabled={!text.trim()}><Plus size={15} aria-hidden="true" /> Add</Button>
    </div>
  );
}

function ToolCard({ title, count, hint, wide, children }: { title: string; count: number; hint: React.ReactNode; wide?: boolean; children: React.ReactNode }) {
  return (
    <section className={`${styles.listCard} ${wide ? styles.listWide : ''}`} aria-label={title}>
      <header className={styles.toolHead}>
        <h3 className={styles.listTitle}>{title} <span className={styles.dim}>{count}</span></h3>
        <p className={styles.listHint}>{hint}</p>
      </header>
      {children}
    </section>
  );
}

const Pill = ({ on, label, title, disabled, onClick }: { on: boolean; label: string; title: string; disabled?: boolean; onClick: () => void }) => (
  <button type="button" className={`${styles.toolPill} ${on ? styles.pillOn : ''}`} aria-pressed={on} title={title} disabled={disabled} onClick={onClick}>{label}</button>
);

function ListEditor({ kind, items, api, extra, usage, unit, canEdit }: { kind: OptionKind; items: OptionItem[]; api: LogisticsApi; extra?: string; usage: Map<string, number> | null; unit: 'device' | 'prize'; canEdit: boolean }) {
  return (
    <ToolCard title={KIND_LABELS[kind]} count={items.length} hint={`${KIND_HINTS[kind]}${extra ? ` ${extra}` : ''}`}>
      {items.length === 0 ? <p className={styles.muted}>Nothing here yet.</p> : (
        <ul className={styles.toolRows}>
          {items.map((o) => <OptionRow key={o.id} kind={kind} o={o} api={api} used={usage ? usage.get(o.value) ?? 0 : null} unit={unit} canEdit={canEdit} />)}
        </ul>
      )}
      {canEdit && <AddRow placeholder="Add a value" label={`Add to ${KIND_LABELS[kind]}`} onAdd={async (v) => (await api.addOption(kind, v)) !== null} />}
    </ToolCard>
  );
}

const useText = (used: number | null, unit: string) => (used === null ? '' : used === 0 ? 'Not used' : `${used} ${unit}${used === 1 ? '' : 's'}`);

function OptionRow({ kind, o, api, used, unit, canEdit }: { kind: OptionKind; o: OptionItem; api: LogisticsApi; used: number | null; unit: string; canEdit: boolean }) {
  return (
    <li className={styles.toolRow}>
      <span className={styles.optName}><TextCell value={o.value} canEdit={canEdit} strong onSave={(v) => { if (v) void api.changeOption(o.id, { value: v }); }} /></span>
      {kind === 'type' && (
        <span className={styles.toolPills}>
          <Pill on={!!o.counted} disabled={!canEdit} label="Counted" title="Counted: one row with an estimated quantity instead of one row per item" onClick={() => void api.changeOption(o.id, { counted: !o.counted })} />
          <Pill on={!!o.main} disabled={!canEdit} label="Main Device" title="Main device: names a set (a PC with its monitor and keyboard) and comes first in it" onClick={() => void api.changeOption(o.id, { main: !o.main })} />
        </span>
      )}
      <span className={styles.toolUse}>{useText(used, unit)}</span>
      {canEdit && <RowMenu label={`More for ${o.value}`} items={[{ label: used ? `In Use, Can’t Delete` : 'Delete', danger: !used, disabled: !!used, onClick: () => void api.deleteOption(kind, o.id) }]} />}
    </li>
  );
}

// The steps every device goes through on event day, in order. "For" says which devices a step is for; "Review parts" shows the device's parts to tick present or missing at that step.
function StepsEditor({ api, items, kind, canEdit }: { api: LogisticsApi; items: OptionItem[]; kind: 'step' | 'prize_step'; canEdit: boolean }) {
  const help = kind === 'step'
    ? '“For” picks which devices a step applies to. “Review Parts” lets the person tick each part present or missing at that step. “Back to Storage” is for club devices; “Returned to owner” is for sponsor and loaner devices.'
    : '“Gives Out” uses the prize’s stock up at that step. “Leftovers” counts only what wasn’t given out, which goes back to storage.';
  return (
    <ToolCard title={KIND_LABELS[kind]} count={items.length} wide hint={<>{KIND_HINTS[kind]}</>}>
      <PhoneFold label="What the options mean"><p className={styles.listHint}>{help}</p></PhoneFold>
      <ol className={styles.toolRows}>
        {items.map((o, i) => <StepRow key={o.id} o={o} n={i + 1} kind={kind} first={i === 0} last={i === items.length - 1} api={api} canEdit={canEdit} />)}
      </ol>
      {canEdit && <AddRow placeholder="Add a step" label="Add a step" onAdd={async (v) => (await api.addOption(kind, v, kind === 'step' ? { applies: 'all' } : {})) !== null} />}
    </ToolCard>
  );
}

function StepRow({ o, n, kind, first, last, api, canEdit }: { o: OptionItem; n: number; kind: 'step' | 'prize_step'; first: boolean; last: boolean; api: LogisticsApi; canEdit: boolean }) {
  return (
    <li className={styles.toolRow}>
      <span className={styles.toolNum} aria-hidden="true">{n}</span>
      <span className={styles.optName}><TextCell value={o.value} canEdit={canEdit} strong onSave={(v) => { if (v) void api.changeOption(o.id, { value: v }); }} /></span>
      <span className={styles.toolPills}>
        {kind === 'prize_step' ? <>
          <Pill on={!!o.gives} disabled={!canEdit} label="Gives Out" title="Gives the prize out: uses its stock up" onClick={() => void api.changeOption(o.id, { gives: !o.gives })} />
          <Pill on={!!o.leftover} disabled={!canEdit} label="Leftovers" title="Only what wasn’t given out: counts what goes back to storage" onClick={() => void api.changeOption(o.id, { leftover: !o.leftover })} />
        </> : <>
          <PickCell value={APPLIES_LABELS[(o.applies ?? 'all') as Applies]} options={(Object.keys(APPLIES_LABELS) as Applies[]).map((a) => APPLIES_LABELS[a])} clearable={false} canEdit={canEdit} onSave={(v) => { const a = (Object.keys(APPLIES_LABELS) as Applies[]).find((k) => APPLIES_LABELS[k] === v); if (a) void api.changeOption(o.id, { applies: a }); }} />
          <Pill on={!!o.kit} disabled={!canEdit} label="Review Parts" title="Show the device’s parts to tick present or missing at this step" onClick={() => void api.changeOption(o.id, { kit: !o.kit })} />
        </>}
      </span>
      {canEdit && <RowMenu label={`More for ${o.value}`} items={[
        { label: 'Move Up', disabled: first, onClick: () => void api.changeOption(o.id, { move: 'up' }) },
        { label: 'Move Down', disabled: last, onClick: () => void api.changeOption(o.id, { move: 'down' }) },
        { label: 'Delete', danger: true, onClick: () => void api.deleteOption(kind, o.id) },
      ]} />}
    </li>
  );
}

// Bundles: a named set of device types that go together ("PC Station" = a PC with its monitor, keyboard, mouse and headset). Choosing a bundle for a plan makes a station with a full set for each.
function BundlesEditor({ api, items, types, canEdit }: { api: LogisticsApi; items: OptionItem[]; types: string[]; canEdit: boolean }) {
  return (
    <ToolCard title={KIND_LABELS.bundle} count={items.length} wide hint={KIND_HINTS.bundle}>
      {items.length === 0 ? <p className={styles.muted}>No bundles yet.</p> : <ul className={styles.bundleList}>{items.map((o) => <BundleCard key={o.id} o={o} api={api} types={types} canEdit={canEdit} />)}</ul>}
      {canEdit && <AddRow placeholder="Add a bundle" label="Add a bundle" onAdd={async (v) => !!types.length && (await api.addOption('bundle', v, { items: [{ type: types[0], qty: 1 }] })) !== null} />}
    </ToolCard>
  );
}

function BundleCard({ o, api, types, canEdit }: { o: OptionItem; api: LogisticsApi; types: string[]; canEdit: boolean }) {
  const list = o.items ?? [];
  const save = (items: { type: string; qty: number }[]) => { if (items.length) void api.changeOption(o.id, { items }); };
  return (
    <li className={styles.bundleCard}>
      <div className={styles.toolRow}>
        <span className={styles.optName}><TextCell value={o.value} canEdit={canEdit} strong onSave={(v) => { if (v) void api.changeOption(o.id, { value: v }); }} /></span>
        <span className={styles.toolUse}>{list.reduce((n, x) => n + x.qty, 0)} items</span>
        {canEdit && <RowMenu label={`More for ${o.value}`} items={[{ label: 'Delete Bundle', danger: true, onClick: () => void api.deleteOption('bundle', o.id) }]} />}
      </div>
      <ul className={styles.bundleItems}>
        {list.map((it, i) => (
          <li key={i} className={styles.toolRow}>
            <NumberCell value={it.qty} canEdit={canEdit} label={`How many ${it.type}`} onSave={(n) => save(list.map((x, j) => (j === i ? { ...x, qty: Math.min(20, Math.max(1, Math.round(n ?? 1) || 1)) } : x)))} />
            <span className={styles.optName}><PickCell value={it.type} options={types} clearable={false} canEdit={canEdit} onSave={(v) => v && save(list.map((x, j) => (j === i ? { ...x, type: v } : x)))} /></span>
            {canEdit && <RowMenu label={`More for ${it.type}`} items={[{ label: list.length <= 1 ? 'A Bundle Needs One Device' : 'Remove From Bundle', danger: list.length > 1, disabled: list.length <= 1, onClick: () => save(list.filter((_, j) => j !== i)) }]} />}
          </li>
        ))}
      </ul>
      {canEdit && <PickCell value={null} options={types} clearable={false} shown="Add a device type" canEdit onSave={(v) => v && save([...list, { type: v, qty: 1 }])} />}
    </li>
  );
}

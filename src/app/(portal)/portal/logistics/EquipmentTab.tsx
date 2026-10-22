'use client';

import { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Search, TriangleAlert } from 'lucide-react';
import Button from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import { CONDITIONS, UNUSABLE, conditionLabel } from '@/lib/logistics/constants';
import { quantityText, tagKey, type Device, type DevicePatch } from '@/lib/logistics/devices';
import { Combo } from './Combo';
import { PickCell, TextCell } from './Cells';
import DeviceDialog from './DeviceDialog';
import type { Catalog, LogisticsApi } from './useLogistics';
import styles from './logistics.module.css';

const SHOW = 150;
const placeOf = (d: Pick<Device, 'shelf' | 'tier'>) => [d.shelf, d.tier].filter(Boolean).join(' · ');
const missingCount = (d: Device) => d.kit.filter((k) => k.missing).length;
// "Needs attention": dead or disappeared, or a part is missing. Something that was thrown away on purpose is settled, so it is not listed.
const isProblem = (d: Device) => d.condition === 'dead' || d.condition === 'disappeared' || missingCount(d) > 0;
// Devices with an ID first (TECM2 before TECM10), counted rows (no ID) after them, grouped by type.
const byId = (a: Device, b: Device) => (a.tag === null ? 1 : 0) - (b.tag === null ? 1 : 0) || (a.tag ?? a.type).localeCompare(b.tag ?? b.type, undefined, { numeric: true, sensitivity: 'base' });

function useWide() {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 900px)');
    const on = () => setWide(mq.matches);
    on(); mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return wide;
}

function ConditionBadge({ c }: { c: Device['condition'] }) {
  const tone = c === 'working' || c === 'brand_new' ? styles.good : UNUSABLE.includes(c) ? styles.bad : styles.neutral;
  return <span className={`${styles.badge} ${tone}`}>{conditionLabel(c)}</span>;
}

function ConditionCell({ d, canEdit, onSave }: { d: Device; canEdit: boolean; onSave: (c: Device['condition']) => void }) {
  const [on, setOn] = useState(false);
  if (!canEdit) return <ConditionBadge c={d.condition} />;
  if (!on) return <button type="button" className={styles.editCell} onClick={() => setOn(true)} aria-label={`Condition: ${conditionLabel(d.condition)}. Change`}><ConditionBadge c={d.condition} /></button>;
  return <Combo value={conditionLabel(d.condition)} options={CONDITIONS.map((c) => c.label)} compact autoFocus clearable={false} onClose={() => setOn(false)} onChange={(v) => { const c = CONDITIONS.find((x) => x.label === v); if (c && c.id !== d.condition) onSave(c.id); }} />;
}

// Counted items show their (estimated) quantity; the rest show how many parts are in the kit, or a red flag for what is missing.
function KitCell({ d, counted }: { d: Device; counted: boolean }) {
  const miss = missingCount(d);
  if (counted) return <span className={styles.qty}>{quantityText(d)}</span>;
  if (miss) return <span className={`${styles.badge} ${styles.bad}`}>{miss} missing</span>;
  return <span className={styles.dim}>{d.kit.length ? `${d.kit.length} ${d.kit.length === 1 ? 'part' : 'parts'}` : '—'}</span>;
}

export default function EquipmentTab({ api, data }: { api: LogisticsApi; data: Catalog }) {
  const wide = useWide();
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [shelf, setShelf] = useState('');
  const [condition, setCondition] = useState('');
  const [problems, setProblems] = useState(false);
  const [limit, setLimit] = useState(SHOW);
  const [dialog, setDialog] = useState<{ device: Device | null; template?: Partial<Device> | null } | null>(null);
  const canEdit = data.canManage;

  const rank = useMemo(() => { const m = new Map(data.lists.type.map((t, i) => [t.value, i])); return (type: string) => m.get(type) ?? 9999; }, [data.lists.type]);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const key = tagKey(q);
    return data.devices
      .filter((d) => (!type || d.type === type) && (!shelf || d.shelf === shelf) && (!condition || d.condition === condition) && (!problems || isProblem(d)))
      .filter((d) => !needle || (d.tag && tagKey(d.tag).includes(key)) || [d.name, d.type, d.shelf, d.tier, d.place_note, d.notes].some((x) => x?.toLowerCase().includes(needle)))
      .sort((a, b) => rank(a.type) - rank(b.type) || byId(a, b));   // the Type dropdown's order, then by ID
  }, [data.devices, q, type, shelf, condition, problems, rank]);
  useEffect(() => setLimit(SHOW), [q, type, shelf, condition, problems]);

  const shown = rows.slice(0, limit);
  const problemCount = useMemo(() => data.devices.filter(isProblem).length, [data.devices]);
  const save = (d: Device, patch: DevicePatch) => { void api.saveDevice(d.id, patch); };
  const open = (device: Device | null, template?: Partial<Device> | null) => setDialog({ device, template });
  const filtered = !!(q || type || shelf || condition || problems);

  return (
    <div className={styles.tab}>
      <div className={styles.toolbar}>
        <div className={styles.search}><Search size={15} aria-hidden="true" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by ID, name, shelf or note" aria-label="Search equipment" /></div>
        <div className={styles.filters}>
          <Select value={type} onChange={(e) => setType(e.target.value)} aria-label="Type"><option value="">All types</option>{data.lists.type.map((t) => <option key={t.id} value={t.value}>{t.value}</option>)}</Select>
          <Select value={shelf} onChange={(e) => setShelf(e.target.value)} aria-label="Shelf"><option value="">All shelves</option>{data.lists.shelf.map((t) => <option key={t.id} value={t.value}>{t.value}</option>)}</Select>
          <Select value={condition} onChange={(e) => setCondition(e.target.value)} aria-label="Condition"><option value="">Any condition</option>{CONDITIONS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select>
        </div>
        <div className={styles.toolbarRow}>
          <button type="button" className={`${styles.pill} ${problems ? styles.pillOn : ''}`} aria-pressed={problems} onClick={() => setProblems((v) => !v)}><TriangleAlert size={13} aria-hidden="true" /> Needs attention{problemCount ? ` (${problemCount})` : ''}</button>
          <span className={styles.count}>{filtered ? `${rows.length} of ${data.devices.length}` : `${data.devices.length}`} {data.devices.length === 1 ? 'item' : 'items'}</span>
          {canEdit && <Button className={styles.addBtn} onClick={() => open(null)}><Plus size={15} aria-hidden="true" /> Add Device</Button>}
        </div>
      </div>

      {dialog && <DeviceDialog api={api} data={data} device={dialog.device} template={dialog.template ?? null} onClose={() => setDialog(null)} onClone={(draft) => setDialog({ device: null, template: draft })} />}
      {data.devices.length === 0 ? (
        <div className={styles.empty}><p>{canEdit ? 'No equipment yet. Add the first device, then use “Save And Add Another” to enter a run of them quickly.' : 'No equipment has been added yet.'}</p></div>
      ) : rows.length === 0 ? (
        <div className={styles.empty}><p>Nothing matches.</p></div>
      ) : wide ? (
        <div className={styles.gridWrap}>
          <table className={styles.grid}>
            <thead><tr><th>ID</th><th>Name</th><th>Type</th><th>Shelf</th><th>Tier</th><th>Condition</th><th>Kit</th><th aria-label="Open" /></tr></thead>
            <tbody>
              {shown.map((d) => (
                <tr key={d.id} className={isProblem(d) ? styles.rowBad : undefined}>
                  <td><TextCell value={d.tag} canEdit={canEdit} strong placeholder="no ID" onSave={(v) => save(d, { tag: v || null })} /></td>
                  <td><TextCell value={d.name} canEdit={canEdit} onSave={(v) => save(d, { name: v || null })} /></td>
                  <td><PickCell value={d.type} options={data.lists.type.map((t) => t.value)} canEdit={canEdit} clearable={false} onSave={(v) => v && save(d, { type: v })} onCreate={(v) => api.addOption('type', v)} /></td>
                  <td><PickCell locate value={d.shelf} options={data.lists.shelf.map((t) => t.value)} canEdit={canEdit} onSave={(v) => save(d, { shelf: v })} onCreate={(v) => api.addOption('shelf', v)} /></td>
                  <td><PickCell value={d.tier} options={data.lists.tier.map((t) => t.value)} canEdit={canEdit} onSave={(v) => save(d, { tier: v })} onCreate={(v) => api.addOption('tier', v)} /></td>
                  <td><ConditionCell d={d} canEdit={canEdit} onSave={(c) => save(d, { condition: c })} /></td>
                  <td><KitCell d={d} counted={!!data.lists.type.find((t) => t.value === d.type)?.counted} /></td>
                  <td><button type="button" className={styles.iconBtn} onClick={() => open(d)} aria-label={`${canEdit ? 'Edit' : 'Open'} ${d.tag ?? d.type}`}><Pencil size={14} aria-hidden="true" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ul className={styles.cards}>
          {shown.map((d) => (
            <li key={d.id}>
              <button type="button" className={`${styles.card} ${isProblem(d) ? styles.cardBad : ''}`} onClick={() => open(d)}>
                <span className={styles.cardTop}><b className={styles.cardId}>{d.tag ?? 'No ID'}</b><ConditionBadge c={d.condition} /></span>
                <span className={styles.cardType}>{d.type}{d.name ? ` · ${d.name}` : ''}</span>
                <span className={styles.cardMeta}>
                  <span>{placeOf(d) || <span className={styles.notLocated}>Not located yet</span>}</span>
                  {data.lists.type.find((t) => t.value === d.type)?.counted && <span className={styles.qty}>{quantityText(d)}</span>}
                  {missingCount(d) > 0 && <span className={`${styles.badge} ${styles.bad}`}>{missingCount(d)} missing</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {rows.length > limit && <div className={styles.more}><Button variant="secondary" onClick={() => setLimit(rows.length)}>Show All {rows.length}</Button></div>}

    </div>
  );
}

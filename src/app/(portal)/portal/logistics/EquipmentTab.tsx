'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, TriangleAlert } from 'lucide-react';
import Button from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import { CONDITIONS, UNUSABLE, conditionLabel } from '@/lib/logistics/constants';
import { quantityText, tagKey, type Device, type DevicePatch } from '@/lib/logistics/devices';
import { Combo } from './Combo';
import { RowMenu } from './RowMenu';
import { interactive } from './interactive';
import { PickCell, TextCell } from './Cells';
import { EQUIPMENT_COLS, GridHead, gridStyle } from './gridTable';
import { groupRows, type DeviceGroup } from '@/lib/logistics/deviceGroups';
import DeviceDialog from './DeviceDialog';
import type { Catalog, LogisticsApi } from './useLogistics';
import { tapTwice } from './cellNav';
import styles from './logistics.module.css';

const SHOW = 150;
const missingCount = (d: Device) => d.kit.filter((k) => k.missing).length;
// "Needs attention": dead or disappeared, or a part is missing. Something that was thrown away on purpose is settled, so it is not listed.
const isProblem = (d: Device) => d.condition === 'dead' || d.condition === 'disappeared' || missingCount(d) > 0;
// Devices with an ID first (TECM2 before TECM10), counted rows (no ID) after them, grouped by type.
const byId = (a: Device, b: Device) => (a.tag === null ? 1 : 0) - (b.tag === null ? 1 : 0) || (a.tag ?? a.type).localeCompare(b.tag ?? b.type, undefined, { numeric: true, sensitivity: 'base' });

function ConditionBadge({ c }: { c: Device['condition'] }) {
  const tone = c === 'working' || c === 'brand_new' ? styles.good : UNUSABLE.includes(c) ? styles.bad : styles.neutral;
  return <span className={`${styles.badge} ${tone}`}>{conditionLabel(c)}</span>;
}

function ConditionCell({ d, canEdit, onSave }: { d: Device; canEdit: boolean; onSave: (c: Device['condition']) => void }) {
  const [on, setOn] = useState(false);
  if (!canEdit) return <ConditionBadge c={d.condition} />;
  if (!on) return <button type="button" className={styles.editCell} onClick={(e) => tapTwice(e, () => setOn(true))} aria-label={`Condition: ${conditionLabel(d.condition)}. Change`}><ConditionBadge c={d.condition} /></button>;
  return <Combo value={conditionLabel(d.condition)} options={CONDITIONS.map((c) => c.label)} compact autoFocus clearable={false} onClose={() => setOn(false)} onChange={(v) => { const c = CONDITIONS.find((x) => x.label === v); if (c && c.id !== d.condition) onSave(c.id); }} />;
}

// Counted items show their (estimated) quantity; the rest show how many parts are in the kit, or a red flag for what is missing.
function KitCell({ d, counted }: { d: Device; counted: boolean }) {
  const miss = missingCount(d);
  if (counted) return <span className={styles.qty}>{quantityText(d)}</span>;
  if (miss) return <span className={`${styles.badge} ${styles.bad}`}>{miss} missing</span>;
  return <span className={styles.dim}>{d.kit.length ? `${d.kit.length} ${d.kit.length === 1 ? 'part' : 'parts'}` : '–'}</span>;
}

export default function EquipmentTab({ api, data, group = 'type' }: { api: LogisticsApi; data: Catalog; group?: DeviceGroup }) {
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
  // The devices in groups (Type is the Type list's order, Shelf by shelf, Status puts what needs attention first, Games under each installed game); the stock has no stations or owners, so those show by type.
  const mode = (group === 'station' ? 'type' : group) as Exclude<DeviceGroup, 'station'>;
  const groups = useMemo(() => groupRows(shown.map((d) => ({ d, id: d.id, kind: 'club' as const, type: d.type, where: [d.shelf, d.tier].filter(Boolean).join(' · '), located: !!d.shelf, games_needed: d.games, games: d.games })), mode, { attention: (r) => isProblem(r.d), complete: () => false, day: false }, rank), [shown, mode, rank]);
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
          <button type="button" className={`${styles.pill} ${problems ? styles.pillOn : ''}`} aria-pressed={problems} onClick={() => setProblems((v) => !v)}><TriangleAlert size={13} aria-hidden="true" /><span className={styles.wide}>Needs Attention</span>{problemCount ? <b>{problemCount}</b> : null}</button>
          <span className={styles.count}>{filtered ? `${rows.length} of ${data.devices.length}` : `${data.devices.length}`} {data.devices.length === 1 ? 'device' : 'devices'}</span>
          {canEdit && <Button className={styles.addBtn} onClick={() => open(null)}><Plus size={15} aria-hidden="true" /> Add<span className={styles.wide}>Device</span></Button>}
        </div>
      </div>

      {dialog && <DeviceDialog extrasOnly api={api} data={data} device={dialog.device} template={dialog.template ?? null} onClose={() => setDialog(null)} onClone={(draft) => setDialog({ device: null, template: draft })} />}
      {data.devices.length === 0 ? (
        <div className={styles.empty}><p>{canEdit ? 'No equipment yet. Add the first device, then use “Save And Add Another” to enter a run of them quickly.' : 'No equipment has been added yet.'}</p></div>
      ) : rows.length === 0 ? (
        <div className={styles.empty}><p>Nothing matches.</p></div>
      ) : (
        <div className={styles.prizeGrid}>
          <GridHead cols={EQUIPMENT_COLS} />
          {groups.map((g) => (
            <div key={g.title}>
              {mode !== 'none' && <div className={styles.devGroupHead}><b>{g.title}</b><span>{g.rows.length} {g.rows.length === 1 ? 'device' : 'devices'}</span></div>}
              {g.rows.map(({ d }) => (
            <div key={d.id} className={`${styles.prizeRow} ${styles.clickRow} ${isProblem(d) ? styles.lineBad : ''}`} style={gridStyle(EQUIPMENT_COLS)} onClick={(e) => { if (!interactive(e.target)) open(d); }}>
              <span className={styles.prizeName}><TextCell value={d.tag} canEdit={canEdit} strong placeholder="no ID" onSave={(v) => save(d, { tag: v || null })} /></span>
              <span data-label="Name"><TextCell value={d.name} canEdit={canEdit} onSave={(v) => save(d, { name: v || null })} /></span>
              <span data-label="Type"><PickCell value={d.type} options={data.lists.type.map((t) => t.value)} canEdit={canEdit} clearable={false} onSave={(v) => v && save(d, { type: v })} onCreate={(v) => api.addOption('type', v)} /></span>
              <span data-label="Shelf"><PickCell locate value={d.shelf} options={data.lists.shelf.map((t) => t.value)} canEdit={canEdit} onSave={(v) => save(d, { shelf: v })} onCreate={(v) => api.addOption('shelf', v)} /></span>
              <span data-label="Tier"><PickCell value={d.tier} options={data.lists.tier.map((t) => t.value)} canEdit={canEdit} onSave={(v) => save(d, { tier: v })} onCreate={(v) => api.addOption('tier', v)} /></span>
              <span data-label="Condition"><ConditionCell d={d} canEdit={canEdit} onSave={(c) => save(d, { condition: c })} /></span>
              <span data-label="Kit"><KitCell d={d} counted={!!data.lists.type.find((t) => t.value === d.type)?.counted} /></span>
              <span className={styles.prizeTools}><RowMenu label={`More for ${d.tag ?? d.type}`} items={[{ label: 'Details', onClick: () => open(d) }]} /></span>
            </div>
            ))}
            </div>
          ))}
        </div>
      )}
      {rows.length > limit && <div className={styles.more}><Button variant="secondary" onClick={() => setLimit(rows.length)}>Show All {rows.length}</Button></div>}

    </div>
  );
}

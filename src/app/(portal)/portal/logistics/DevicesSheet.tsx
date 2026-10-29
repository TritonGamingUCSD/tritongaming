'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Notice from '@/components/ui/Notice';
import Loading from '@/components/Loading/Loading';
import { call } from '@/lib/ui/apiCall';
import { showToast } from '@/lib/ui/toast';
import { CONDITIONS, conditionLabel } from '@/lib/logistics/constants';
import { quantityText, type Device, type DevicePatch, type KitLine } from '@/lib/logistics/devices';
import type { CellValue } from '@/lib/logistics/sheetMath';
import type { Catalog, LogisticsApi } from './useLogistics';
import Sheet, { type SheetCol } from './Sheet';
import styles from './logistics.module.css';
import sh from './sheet.module.css';

interface SheetPlan {
  id: string;
  slug: string;
  name: string;
  starts_on: string;
  ends_on: string;
}
interface SheetStation {
  id: string;
  plan_id: string;
  name: string;
}
interface SheetItem {
  plan_id: string;
  device_id: string;
  station_id: string | null;
  role: 'planned' | 'backup';
}
interface SheetData {
  plans: SheetPlan[];
  stations: SheetStation[];
  items: SheetItem[];
  steps: { id: string; name: string }[];
  done: { plan_id: string; device_id: string; step_id: string }[];
  canManage: boolean;
}
const COND_OF = Object.fromEntries(CONDITIONS.map((c) => [c.label, c.id])) as Record<string, Device['condition']>;
const NOT_HERE = 'Not in this event',
  NO_STATION = 'In the event, no station';

// "Mouse x1, Charger x1 (missing)" ⇄ the kit list. A part that is already on the device keeps its "missing" mark unless the text says otherwise.
const kitText = (d: Device) => d.kit.map((k) => `${k.item}${k.qty !== 1 ? ` x${k.qty}` : ''}${k.missing ? ' (missing)' : ''}`).join(', ');
const parseKit = (text: string): KitLine[] =>
  text
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const missing = /\(missing\)\s*$/i.test(p),
        body = p.replace(/\(missing\)\s*$/i, '').trim(),
        m = /^(.*?)\s*x\s*(\d+)$/i.exec(body);
      return { item: (m ? m[1] : body).trim(), qty: m ? Math.max(1, Number(m[2])) : 1, missing };
    })
    .filter((k) => k.item);
const listText = (v: string[]) => v.join(', ');
const parseList = (text: string) =>
  text
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
const byId = (a: Device, b: Device) =>
  (a.tag === null ? 1 : 0) - (b.tag === null ? 1 : 0) || (a.tag ?? a.type).localeCompare(b.tag ?? b.type, undefined, { numeric: true, sensitivity: 'base' });

// Devices as one big spreadsheet: a row per device with every field in a column, then each open event's station and role for it. Every cell that can change is edited in place; choosing an event's station puts the
// device in that event (or moves it), and "Not in this event" takes it out.
export default function DevicesSheet({ api, data }: { api: LogisticsApi; data: Catalog }) {
  const [sheet, setSheet] = useState<SheetData | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    const r = await call<SheetData>('/api/logistics/devices/sheet', 'GET');
    if (r.ok) {
      setSheet(r.data);
      setError('');
    } else setError(r.error);
  }, []);
  useEffect(() => {
    void load();
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, 90000);
    return () => window.clearInterval(id);
  }, [load]);

  const can = data.canManage;
  const list = (k: 'type' | 'shelf' | 'tier' | 'port' | 'game') => data.lists[k].map((o) => o.value);
  const countedTypes = useMemo(() => new Set(data.lists.type.filter((t) => t.counted).map((t) => t.value)), [data.lists.type]);
  const rows = useMemo(() => [...data.devices].sort(byId), [data.devices]);
  const itemOf = useMemo(() => {
    const m = new Map<string, SheetItem>();
    for (const i of sheet?.items ?? []) m.set(`${i.plan_id}:${i.device_id}`, i);
    return m;
  }, [sheet]);

  const save = (d: Device, patch: DevicePatch) => async () => (await api.saveDevice(d.id, patch)) !== null;
  const addList = (kind: 'type' | 'shelf' | 'tier') => async (v: string) => (await api.addOption(kind, v)) !== null;

  const planAction = async (path: string, method: 'POST' | 'PATCH' | 'DELETE', body: Record<string, unknown>) => {
    const r = await call(path, method, body);
    if (!r.ok) {
      showToast(r.error);
      await load();
      return false;
    }
    await load();
    return true;
  };
  const doneSet = useMemo(() => new Set((sheet?.done ?? []).map((x) => `${x.plan_id}:${x.device_id}:${x.step_id}`)), [sheet]);
  // Tick or clear one step for one device; the ticks on screen change at once (no reload of the whole sheet).
  const tick = async (plan: string, device: string, step: string, on: boolean): Promise<boolean> => {
    const r = await call(`/api/logistics/events/${plan}/steps`, on ? 'POST' : 'DELETE', { device_id: device, step_id: step });
    if (!r.ok) {
      showToast(r.error);
      return false;
    }
    setSheet((cur) => {
      if (!cur) return cur;
      const rest = cur.done.filter((x) => !(x.plan_id === plan && x.device_id === device && x.step_id === step));
      return { ...cur, done: on ? [...rest, { plan_id: plan, device_id: device, step_id: step }] : rest };
    });
    return true;
  };
  const eventCols = (pl: SheetPlan): SheetCol<Device>[] => {
    const st = (sheet?.stations ?? []).filter((s) => s.plan_id === pl.id);
    return [
      {
        id: `s:${pl.id}`,
        label: 'Station',
        group: pl.name,
        width: 170,
        kind: 'select',
        nullable: true,
        options: () => [NOT_HERE, ...(st.length ? [] : [NO_STATION]), ...st.map((s) => s.name)],
        title: 'Which station of this event the device goes to. “Not in this event” takes it out.',
        get: (d) => {
          const i = itemOf.get(`${pl.id}:${d.id}`);
          return !i ? '' : i.station_id ? (st.find((s) => s.id === i.station_id)?.name ?? NO_STATION) : NO_STATION;
        },
        display: (d) => {
          const i = itemOf.get(`${pl.id}:${d.id}`);
          return !i ? '' : i.station_id ? (st.find((s) => s.id === i.station_id)?.name ?? '') : 'no station';
        },
        set: async (d, v) => {
          const name = String(v ?? ''),
            had = itemOf.get(`${pl.id}:${d.id}`);
          if (!name || name === NOT_HERE) return had ? planAction(`/api/logistics/events/${pl.id}/devices`, 'DELETE', { device_ids: [d.id] }) : true;
          const station = name === NO_STATION ? null : st.find((s) => s.name === name)?.id;
          if (station === undefined) return false;
          return had
            ? planAction(`/api/logistics/events/${pl.id}/devices`, 'PATCH', { device_ids: [d.id], station_id: station })
            : planAction(`/api/logistics/events/${pl.id}/devices`, 'POST', { device_ids: [d.id], station_id: station });
        },
      },
      {
        id: `r:${pl.id}`,
        label: 'Role',
        group: pl.name,
        width: 96,
        kind: 'select',
        options: () => ['Planned', 'Backup'],
        get: (d) => {
          const i = itemOf.get(`${pl.id}:${d.id}`);
          return i ? (i.role === 'backup' ? 'Backup' : 'Planned') : '';
        },
        editable: (d) => itemOf.has(`${pl.id}:${d.id}`),
        set: (d, v) =>
          v === 'Planned' || v === 'Backup'
            ? planAction(`/api/logistics/events/${pl.id}/devices`, 'PATCH', { device_ids: [d.id], role: v === 'Backup' ? 'backup' : 'planned' })
            : false,
      },
      // Every event-day step, a tick for each (the crew ticks them on the day; they can be set or cleared here too). Folded away until the event's header is opened.
      ...(sheet?.steps ?? []).map((st): SheetCol<Device> => ({
        id: `x:${pl.id}:${st.id}`,
        label: st.name,
        group: pl.name,
        detail: true,
        width: 96,
        kind: 'bool',
        title: `Ticked when “${st.name}” is done for this device in this event.`,
        get: (d) => doneSet.has(`${pl.id}:${d.id}:${st.id}`),
        editable: (d) => itemOf.has(`${pl.id}:${d.id}`),
        set: (d, v) => tick(pl.id, d.id, st.id, v === true),
      })),
    ];
  };

  const cols: SheetCol<Device>[] = [
    { id: 'tag', label: 'ID', width: 120, kind: 'text', nullable: true, get: (d) => d.tag ?? '', set: (d, v) => save(d, { tag: v ? String(v) : null })() },
    { id: 'name', label: 'Name', width: 200, kind: 'text', nullable: true, get: (d) => d.name ?? '', set: (d, v) => save(d, { name: v ? String(v) : null })() },
    {
      id: 'type',
      label: 'Type',
      width: 150,
      kind: 'select',
      required: true,
      options: () => list('type'),
      create: addList('type'),
      get: (d) => d.type,
      set: (d, v) => (v ? save(d, { type: String(v) })() : false),
    },
    {
      id: 'shelf',
      label: 'Shelf',
      width: 130,
      kind: 'select',
      nullable: true,
      options: () => list('shelf'),
      create: addList('shelf'),
      get: (d) => d.shelf ?? '',
      set: (d, v) => save(d, { shelf: v ? String(v) : null })(),
    },
    {
      id: 'tier',
      label: 'Tier',
      width: 90,
      kind: 'select',
      nullable: true,
      options: () => list('tier'),
      create: addList('tier'),
      get: (d) => d.tier ?? '',
      set: (d, v) => save(d, { tier: v ? String(v) : null })(),
    },
    {
      id: 'condition',
      label: 'Condition',
      width: 130,
      kind: 'select',
      options: () => CONDITIONS.map((c) => c.label),
      get: (d) => conditionLabel(d.condition),
      set: (d, v) => (COND_OF[String(v)] ? save(d, { condition: COND_OF[String(v)] })() : false),
    },
    {
      id: 'place',
      label: 'Where Exactly',
      width: 180,
      kind: 'text',
      nullable: true,
      get: (d) => d.place_note ?? '',
      set: (d, v) => save(d, { place_note: v ? String(v) : null })(),
    },
    {
      id: 'qty',
      label: 'Quantity',
      width: 92,
      kind: 'number',
      align: 'right',
      nullable: true,
      title: 'For counted items (a mousepad): how many there are.',
      get: (d) => d.quantity,
      display: (d) => (countedTypes.has(d.type) || d.quantity !== null ? quantityText(d) : ''),
      set: (d, v) => save(d, { quantity: v === null ? null : Number(v) })(),
    },
    {
      id: 'est',
      label: 'Estimate',
      width: 80,
      kind: 'bool',
      title: 'The quantity is a guess.',
      get: (d) => d.quantity_is_estimate,
      editable: (d) => d.quantity !== null,
      set: (d, v) => save(d, { quantity_is_estimate: v === true })(),
    },
    {
      id: 'ports',
      label: 'Ports',
      width: 170,
      kind: 'text',
      nullable: true,
      title: 'Comma separated.',
      get: (d) => listText(d.ports),
      set: (d, v) => save(d, { ports: parseList(String(v ?? '')) })(),
    },
    {
      id: 'games',
      label: 'Games',
      width: 220,
      kind: 'text',
      nullable: true,
      title: 'Installed games, comma separated.',
      get: (d) => listText(d.games),
      set: (d, v) => save(d, { games: parseList(String(v ?? '')) })(),
    },
    {
      id: 'kit',
      label: 'Kit',
      width: 260,
      kind: 'text',
      nullable: true,
      title: 'Parts that go with it, like “Mouse, Charger x2, HDMI cable (missing)”.',
      get: (d) => kitText(d),
      set: (d, v) => save(d, { kit: parseKit(String(v ?? '')) })(),
    },
    { id: 'login', label: 'Login', width: 150, kind: 'text', nullable: true, get: (d) => d.login ?? '', set: (d, v) => save(d, { login: v ? String(v) : null })() },
    { id: 'notes', label: 'Notes', width: 260, kind: 'text', nullable: true, get: (d) => d.notes ?? '', set: (d, v) => save(d, { notes: v ? String(v) : null })() },
    ...(sheet?.plans ?? []).flatMap(eventCols),
  ];

  if (!sheet) return <div className={styles.tab}>{error ? <Notice tone="error">{error}</Notice> : <Loading variant="inline" label="Loading the sheet…" />}</div>;
  const add = can
    ? {
        label: 'Add a device: type its ID, then pick its type…',
        required: ['type'],
        create: async (d: Record<string, CellValue>) =>
          (await api.saveDevice(null, { type: String(d.type ?? ''), tag: d.tag ? String(d.tag) : null, name: d.name ? String(d.name) : null })) !== null,
      }
    : undefined;
  return (
    <div className={sh.sheetPage}>
      {error && (
        <div role="alert" onClick={() => setError('')}>
          <Notice tone="error">{error}</Notice>
        </div>
      )}
      <Sheet<Device>
        id="devices"
        rows={rows}
        rowKey={(d) => d.id}
        cols={cols}
        canEdit={can}
        add={add}
        noun="device"
        rowTone={(d) => (d.condition === 'dead' || d.condition === 'disappeared' || d.kit.some((k) => k.missing) ? 'bad' : undefined)}
        onDelete={
          can
            ? async (d) => {
                await api.removeDevice(d.id);
              }
            : undefined
        }
        deleteLabel={(d) => d.tag ?? d.type}
      />
    </div>
  );
}

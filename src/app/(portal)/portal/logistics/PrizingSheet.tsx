'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Gift } from 'lucide-react';
import Notice from '@/components/ui/Notice';
import Loading from '@/components/Loading/Loading';
import PictureDialog from '@/components/ui/PictureDialog';
import { Select } from '@/components/ui/Field';
import { compressImage } from '@/lib/ui/compressImage';
import { call } from '@/lib/ui/apiCall';
import { showToast } from '@/lib/ui/toast';
import { LEVELS, LEVEL_LABEL, isLoose, setLooseSizes, type PrizeStepDef, type StockLevel } from '@/lib/logistics/prizes';
import type { CellValue } from '@/lib/logistics/sheetMath';
import type { Catalog, LogisticsApi } from './useLogistics';
import type { PrizeRow, PrizesApi } from './usePrizes';
import Sheet, { type SheetCol } from './Sheet';
import styles from './logistics.module.css';
import sh from './sheet.module.css';

interface SheetPlan { id: string; slug: string; name: string; starts_on: string; ends_on: string }
interface SheetStation { id: string; plan_id: string; name: string; prize_only: boolean }
interface SheetLine { id: string; plan_id: string; station_id: string; prize_id: string; quantity: number; counts: Record<string, number>; given: number; back: number; held: number }
interface SheetData { plans: SheetPlan[]; stations: SheetStation[]; steps: PrizeStepDef[]; lines: SheetLine[]; canManage: boolean }
const LEVEL_OF = Object.fromEntries(LEVELS.map((l) => [LEVEL_LABEL[l], l])) as Record<string, StockLevel>;
const planPath = (plan: string, station: string, prize: string) => `/api/logistics/events/${plan}/stations/${station}/prizes/${prize}`;

// Prizing as one big spreadsheet: a row per prize with every field in a column, then the totals across the open events, then each open event's planned, given out and back. Every cell that can change is edited in
// place. Open a row (the chevron) to see and change that prize's lines in each event: station, how many, and every step's count, or to put it on another station.
export default function PrizingSheet({ api, data, prizes }: { api: LogisticsApi; data: Catalog; prizes: PrizesApi }) {
  const [sheet, setSheet] = useState<SheetData | null>(null);
  const [error, setError] = useState('');
  const [photoFor, setPhotoFor] = useState<PrizeRow | null>(null);
  useMemo(() => setLooseSizes(data.lists.prize_size.filter((o) => o.loose).map((o) => o.value)), [data.lists.prize_size]);

  const load = useCallback(async () => {
    const r = await call<SheetData>('/api/logistics/prizes/sheet', 'GET');
    if (r.ok) { setSheet(r.data); setError(''); } else setError(r.error);
  }, []);
  useEffect(() => {
    void load();
    const id = window.setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 90000);   // what others change shows up
    return () => window.clearInterval(id);
  }, [load]);
  const refresh = useCallback(async () => { await Promise.all([load(), prizes.reload()]); }, [load, prizes]);

  const sponsorName = useMemo(() => new Map(data.sponsors.map((s) => [s.id, s.name])), [data.sponsors]);
  const sponsorId = useMemo(() => new Map(data.sponsors.map((s) => [s.name.toLowerCase(), s.id])), [data.sponsors]);
  const sizes = data.lists.prize_size.map((o) => o.value);
  const types = useMemo(() => [...new Set((prizes.rows ?? []).map((p) => p.type).filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b)), [prizes.rows]);
  const linesOf = useMemo(() => { const m = new Map<string, SheetLine[]>(); for (const l of sheet?.lines ?? []) m.set(l.prize_id, [...(m.get(l.prize_id) ?? []), l]); return m; }, [sheet]);
  const steps = sheet?.steps ?? [];
  const givesStep = steps.find((s) => s.gives), backStep = steps.find((s) => s.leftover);
  const can = data.canManage;

  // ---- changes to lines ------------------------------------------------------------------------------------------------------------------------------------------------------------
  const fail = (msg: string) => { showToast(msg); void refresh(); return false; };
  const setQty = async (l: SheetLine, qty: number): Promise<boolean> => {
    const r = qty < 1 ? await call<{ ok: true }>(planPath(l.plan_id, l.station_id, l.prize_id), 'DELETE', { expected: l.quantity }) : await call(planPath(l.plan_id, l.station_id, l.prize_id), 'PATCH', { quantity: qty, expected: l.quantity });
    if (!r.ok) return fail(r.error);
    await refresh(); return true;
  };
  const setCount = async (l: SheetLine, step: PrizeStepDef, done: number): Promise<boolean> => {
    const r = await call<{ done: number }>(`/api/logistics/events/${l.plan_id}/counts`, 'POST', { line_id: l.id, step_id: step.id, done, expected: l.counts[step.id] ?? 0 });
    if (!r.ok) return fail(r.error);
    await refresh(); return true;
  };
  const addLine = async (plan: string, station: string, prize: string, qty: number): Promise<boolean> => {
    const r = await call(`/api/logistics/events/${plan}/stations/${station}/prizes`, 'POST', { items: [{ prize_id: prize, quantity: qty }] });
    if (!r.ok) return fail(r.error);
    await refresh(); return true;
  };

  // ---- the picture (the one popup: choosing a picture is always the same dialog) --------------------------------------------------------------------------------------------------
  async function applyPhoto(files: File[]) {
    const p = photoFor; if (!p || !files[0]) return;
    const blob = await compressImage(files[0]);
    if (!blob) { showToast('That picture couldn’t be shrunk small enough. Try another picture, or a simpler one.'); return; }
    if (!(await prizes.setPhoto(p.id, blob))) showToast('The picture didn’t save.');
  }

  // ---- the columns -----------------------------------------------------------------------------------------------------------------------------------------------------------------
  const save = (p: PrizeRow, patch: Parameters<PrizesApi['save']>[1]) => async () => (await prizes.save(p.id, patch)) !== null;
  const text = (id: string, label: string, width: number, field: 'bin' | 'source' | 'from_event' | 'notes', extra: Partial<SheetCol<PrizeRow>> = {}): SheetCol<PrizeRow> => ({
    id, label, width, kind: 'text', nullable: true, get: (p) => p[field] ?? '', set: (p, v) => save(p, { [field]: v === null || v === '' ? null : String(v) })(), ...extra,
  });
  const planCols = (pl: SheetPlan): SheetCol<PrizeRow>[] => {
    const one = (p: PrizeRow) => { const ls = (linesOf.get(p.id) ?? []).filter((l) => l.plan_id === pl.id); return ls.length === 1 ? ls[0] : null; };
    const total = (p: PrizeRow, f: (l: SheetLine) => number) => (linesOf.get(p.id) ?? []).filter((l) => l.plan_id === pl.id).reduce((n, l) => n + f(l), 0);
    const stationsHere = (sheet?.stations ?? []).filter((s) => s.plan_id === pl.id);
    const g = pl.name;
    const many = (p: PrizeRow) => (linesOf.get(p.id) ?? []).filter((l) => l.plan_id === pl.id).length > 1;
    return [
      { id: `p:${pl.id}`, label: 'Planned', group: g, width: 92, kind: 'number', align: 'right', title: 'How many are promised in this event. Open the row to see the stations.', get: (p) => total(p, (l) => l.quantity) || null,
        editable: (p) => !many(p) && (one(p) !== null || stationsHere.length === 1),
        set: (p, v) => { const n = Number(v ?? 0); const l = one(p); if (l) return setQty(l, n); if (n > 0 && stationsHere.length === 1) return addLine(pl.id, stationsHere[0].id, p.id, n); return false; }, nullable: true, display: (p) => { const n = total(p, (l) => l.quantity); return n ? <>{n}{many(p) ? <small> ({(linesOf.get(p.id) ?? []).filter((l) => l.plan_id === pl.id).length} stations)</small> : null}</> : ''; } },
      { id: `g:${pl.id}`, label: 'Given Out', group: g, width: 92, kind: 'number', align: 'right', get: (p) => total(p, (l) => l.given) || null, editable: (p) => !many(p) && !!one(p) && !!givesStep, set: (p, v) => { const l = one(p); return l && givesStep ? setCount(l, givesStep, Number(v ?? 0)) : false; }, nullable: true },
      { id: `b:${pl.id}`, label: 'Back', group: g, width: 80, kind: 'number', align: 'right', get: (p) => total(p, (l) => l.back) || null, editable: (p) => !many(p) && !!one(p) && !!backStep, set: (p, v) => { const l = one(p); return l && backStep ? setCount(l, backStep, Number(v ?? 0)) : false; }, nullable: true },
    ];
  };

  const cols: SheetCol<PrizeRow>[] = [
    { id: 'name', label: 'Prize', width: 230, kind: 'text', required: true, get: (p) => p.name, set: (p, v) => save(p, { name: String(v ?? '') })() },
    { id: 'photo', label: 'Picture', width: 74, kind: 'photo', get: (p) => p.photo || null, photo: (p) => setPhotoFor(p),
      display: (p) => (p.photo /* eslint-disable-next-line @next/next/no-img-element */ ? <img src={p.photo} alt="" className={sh.pic} loading="lazy" /> : <Gift size={16} aria-hidden="true" style={{ opacity: 0.45 }} />) },
    { id: 'sponsor', label: 'Sponsor', width: 150, kind: 'select', nullable: true, options: () => data.sponsors.map((s) => s.name), get: (p) => (p.sponsor_id ? sponsorName.get(p.sponsor_id) ?? '' : ''),
      create: async (v) => (await api.saveSponsor(null, { name: v })) !== null,
      set: (p, v) => { const name = String(v ?? '').trim(); if (!name) return save(p, { sponsor_id: null })(); const id = sponsorId.get(name.toLowerCase()); return id ? save(p, { sponsor_id: id })() : false; } },
    { id: 'type', label: 'Type', width: 130, kind: 'select', nullable: true, options: () => types, create: async () => true, get: (p) => p.type ?? '', set: (p, v) => save(p, { type: v ? String(v) : null })() },
    { id: 'size', label: 'Size', width: 130, kind: 'select', nullable: true, options: () => sizes, create: async (v) => (await api.addOption('prize_size', v)) !== null, get: (p) => p.size ?? '', set: (p, v) => save(p, { size: v ? String(v) : null })() },
    { id: 'price', label: 'Price', width: 82, kind: 'money', align: 'right', nullable: true, get: (p) => p.price, set: (p, v) => save(p, { price: v === null ? null : Number(v) })() },
    { id: 'qty', label: 'In Stock', width: 92, kind: 'number', align: 'right', required: false, title: 'How many are on hand. Free merch has a level instead.', get: (p) => (isLoose(p) ? null : p.quantity), editable: (p) => !isLoose(p),
      display: (p) => (isLoose(p) ? '' : p.quantity), set: (p, v) => (async () => (await prizes.save(p.id, { quantity: Number(v ?? 0), expected_quantity: p.quantity })) !== null)() },
    { id: 'level', label: 'Level', width: 96, kind: 'select', title: 'Free merch is counted loosely: plenty, some, low or out.', options: () => LEVELS.map((l) => LEVEL_LABEL[l]), get: (p) => (isLoose(p) ? LEVEL_LABEL[p.stock_level] : ''), editable: (p) => isLoose(p),
      set: (p, v) => (LEVEL_OF[String(v)] ? save(p, { stock_level: LEVEL_OF[String(v)] })() : false) },
    { id: 'planned', label: 'Planned', group: 'All open events', width: 92, kind: 'readonly', align: 'right', title: 'What open events hold back: promised, minus given out, minus back in storage.', get: (p) => (isLoose(p) ? null : p.allocated || null) },
    { id: 'left', label: 'Left', group: 'All open events', width: 80, kind: 'readonly', align: 'right', title: 'In stock minus planned: what is free to promise.', get: (p) => (isLoose(p) ? null : p.left) },
    { id: 'tgiven', label: 'Given Out', group: 'All open events', width: 92, kind: 'readonly', align: 'right', get: (p) => (linesOf.get(p.id) ?? []).reduce((n, l) => n + l.given, 0) || null },
    { id: 'tback', label: 'Back', group: 'All open events', width: 80, kind: 'readonly', align: 'right', get: (p) => (linesOf.get(p.id) ?? []).reduce((n, l) => n + l.back, 0) || null },
    ...(sheet?.plans ?? []).flatMap(planCols),
    { id: 'here', label: 'Here', group: 'More', width: 64, kind: 'bool', title: 'It is physically here (not still on its way).', get: (p) => p.in_hand, set: (p, v) => save(p, { in_hand: v === true })() },
    text('bin', 'Bin', 110, 'bin', { group: 'More' }), text('source', 'Source', 150, 'source', { group: 'More' }), text('from_event', 'From Event', 150, 'from_event', { group: 'More' }),
    { id: 'expires', label: 'Expires', group: 'More', width: 120, kind: 'date', nullable: true, get: (p) => p.expires_on ?? '', set: (p, v) => save(p, { expires_on: v ? String(v) : null })() },
    text('notes', 'Notes', 260, 'notes', { group: 'More' }),
  ];

  // ---- a prize's lines, opened under its row --------------------------------------------------------------------------------------------------------------------------------------
  const detail = (p: PrizeRow) => {
    if (!sheet) return null;
    const mine = linesOf.get(p.id) ?? [];
    return <PrizeLines p={p} lines={mine} sheet={sheet} can={can} setQty={setQty} setCount={setCount} addLine={addLine} />;
  };

  if (!prizes.rows || !sheet) return <div className={styles.tab}>{error || prizes.error ? <Notice tone="error">{error || prizes.error}</Notice> : <Loading variant="inline" label="Loading the sheet…" />}</div>;
  const add = can ? { label: 'Add a prize: type its name…', required: ['name'], create: async (d: Record<string, CellValue>) => (await prizes.save(null, { name: String(d.name ?? '') })) !== null } : undefined;
  return (
    <div className={sh.sheetPage}>
      {(error || prizes.error) && <div role="alert" onClick={() => { setError(''); prizes.setError(''); }}><Notice tone="error">{error || prizes.error}</Notice></div>}
      <Sheet<PrizeRow> id="prizing" rows={prizes.rows} rowKey={(p) => p.id} cols={cols} canEdit={can} add={add} noun="prize" expand={detail}
        rowTone={(p) => (p.left < 0 && !isLoose(p) ? 'bad' : !p.in_hand && p.allocated > 0 ? 'warn' : undefined)}
        onDelete={can ? async (p) => { await prizes.remove(p.id); } : undefined} deleteLabel={(p) => p.name} />
      {photoFor && <PictureDialog title={`Picture of ${photoFor.name}`} current={photoFor.photo || undefined} hint="It is shrunk for you" onUse={(f) => applyPhoto(f)} onRemove={photoFor.photo ? async () => { await prizes.clearPhoto(photoFor.id); } : undefined} onClose={() => setPhotoFor(null)} />}
    </div>
  );
}

// One prize's lines in every open event: the station, how many, and a count for every step (typed numbers, saved on Enter); a line can be taken off (set to 0), and the prize put on another station.
function PrizeLines({ p, lines, sheet, can, setQty, setCount, addLine }: { p: PrizeRow; lines: SheetLine[]; sheet: SheetData; can: boolean; setQty: (l: SheetLine, n: number) => Promise<boolean>; setCount: (l: SheetLine, s: PrizeStepDef, n: number) => Promise<boolean>; addLine: (plan: string, station: string, prize: string, qty: number) => Promise<boolean> }) {
  const [plan, setPlan] = useState(sheet.plans[0]?.id ?? '');
  const stations = sheet.stations.filter((s) => s.plan_id === plan && !lines.some((l) => l.station_id === s.id));
  const [station, setStation] = useState('');
  const [qty, setQtyText] = useState('1');
  const num = (v: string) => Math.max(0, Math.round(Number(v) || 0));
  const field = (value: number, onSave: (n: number) => void, label: string, max?: number) => (
    <input className={sh.mini} type="text" inputMode="numeric" defaultValue={value} key={`${label}:${value}`} disabled={!can} aria-label={label}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur(); e.stopPropagation(); }}
      onBlur={(e) => { const n = Math.min(max ?? 1e6, num(e.currentTarget.value)); if (n !== value) onSave(n); else e.currentTarget.value = String(value); }} />
  );
  return (
    <div className={sh.lines}>
      {lines.length === 0 ? <p className={sh.note}>{p.name} is not on any station of an open event yet.</p> : (
        <table className={sh.lineTable}>
          <thead><tr><th>Event</th><th>Station</th><th>Planned</th>{sheet.steps.map((s) => <th key={s.id} title={s.gives ? 'Takes it out of stock' : s.leftover ? 'Frees it to promise again' : undefined}>{s.name}</th>)}<th>Held</th></tr></thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id}>
                <td>{sheet.plans.find((x) => x.id === l.plan_id)?.name}</td>
                <td>{sheet.stations.find((x) => x.id === l.station_id)?.name}</td>
                <td>{field(l.quantity, (n) => void setQty(l, n), `Planned at ${sheet.stations.find((x) => x.id === l.station_id)?.name}`)}</td>
                {sheet.steps.map((s) => <td key={s.id}>{field(l.counts[s.id] ?? 0, (n) => void setCount(l, s, n), `${s.name} at ${sheet.stations.find((x) => x.id === l.station_id)?.name}`, s.leftover ? l.quantity - l.given : l.quantity)}</td>)}
                <td className={sh.held}>{l.held}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {can && sheet.plans.length > 0 && (
        <div className={sh.addLine}>
          <span>Put it on a station:</span>
          <Select value={plan} onChange={(e) => { setPlan(e.target.value); setStation(''); }} aria-label="Event">{sheet.plans.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select>
          <Select value={station} onChange={(e) => setStation(e.target.value)} aria-label="Station"><option value="">Station…</option>{stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
          <input className={sh.mini} type="text" inputMode="numeric" value={qty} onChange={(e) => setQtyText(e.target.value)} onKeyDown={(e) => e.stopPropagation()} aria-label="How many" />
          <button type="button" className={sh.addBtn} disabled={!station || num(qty) < 1} onClick={() => { void addLine(plan, station, p.id, num(qty)).then((ok) => { if (ok) setStation(''); }); }}>Add</button>
        </div>
      )}
    </div>
  );
}

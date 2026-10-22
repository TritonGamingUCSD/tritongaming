'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, MoreHorizontal, RefreshCw } from 'lucide-react';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import Loading from '@/components/Loading/Loading';
import { confirmHold } from '@/lib/ui/confirmHold';
import { tagKey } from '@/lib/logistics/devices';
import { isUsable, natural, planProblems, rowKind, stationStatus, stepAppliesTo, type StepDef } from '@/lib/logistics/plans';
import BorrowedDialog from './BorrowedDialog';
import DeviceDialog from './DeviceDialog';
import type { Device } from '@/lib/logistics/devices';
import HowItWorks from './HowItWorks';
import { interactive } from './interactive';
import { EditPlanDialog, FillDialog, StationDialog } from './PlanDialogs';
import BorrowedTab from './BorrowedTab';
import DeviceFinder from './DeviceFinder';
import PrizingTab from './PrizingTab';
import SponsorPrizingTab from './SponsorPrizingTab';
import RequestsTab from './RequestsTab';
import SectionTabs from '@/components/ui/SectionTabs';
import type { EventPage } from './logisticsRoute';
import { SheetRows, type SheetCtx } from './PlanSheet';
import SwapDialog from './SwapDialog';
import { planRows, primaryRank, type Row } from './planRows';
import { doneKey, usePlan, type Borrowed, type Slim, type Station, type StepResult } from './usePlans';
import type { Catalog, LogisticsApi } from './useLogistics';
import styles from './logistics.module.css';

// The plan and the event day are one sheet. A block per team, a line per device (or per set), the step boxes on the line. Before the event it is where devices are chosen and what is
// wrong gets fixed; on the day the same lines are ticked: tap a box (tap a ticked one to undo it), or type a device's ID and the picked step is ticked for it, with where to get it and
// which team it goes to. The step to type for follows the work. Anything wrong is marked on its own line.
type Feedback = { tone: 'ok' | 'already' | 'error'; text: string; result?: StepResult; step?: StepDef } | null;
type Target = Pick<Row, 'id' | 'kind' | 'itemKind' | 'tag' | 'type' | 'kit'>;
const time = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
const whereOf = (d: Slim) => (d.kind === 'club' ? [d.shelf, d.tier].filter(Boolean).join(' · ') || 'No place set' : d.kind === 'slot' ? 'Counted: take from stock' : `${d.kind === 'sponsor' ? 'From' : 'From officer'} ${d.owner ?? 'its owner'}`);
const bodyOf = (r: Pick<Row, 'id' | 'kind'>) => (r.kind === 'club' ? { device_id: r.id } : r.kind === 'slot' ? { slot_id: r.id } : { borrowed_id: r.id });
const range = (a: string, b: string) => {
  const f = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });
  return a === b ? f(a) : `${f(a)} to ${f(b)}`;
};

export default function PlanView({ id, data, catalog, page, day, byType, onGroup, onPage, onBack }: { id: string; data: Catalog; catalog: LogisticsApi; page: EventPage; day: boolean; byType: boolean; onGroup: (byType: boolean) => void; onPage: (p: EventPage, day?: boolean) => void; onBack: () => void }) {
  const plan = usePlan(id, true);
  const { detail, error, setError, act } = plan;
  const [picked, setPicked] = useState('');   // '' = follow the work
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [kit, setKit] = useState<{ row: Target; flags: Record<string, boolean> } | null>(null);
  const [swapping, setSwapping] = useState<{ id: string; tag: string | null; type: string; kind: 'club' | 'sponsor' | 'officer' } | null>(null);
  const [borrowing, setBorrowing] = useState<Borrowed | 'new' | null>(null);
  const [deviceEdit, setDeviceEdit] = useState<Device | null>(null);   // a device's own information, changed here instead of in the inventory
  const [editing, setEditing] = useState(false);
  const [stationDialog, setStationDialog] = useState<{ station: Station | null } | null>(null);
  const [filling, setFilling] = useState<{ station: Station | null } | null>(null);
  const [setsOpenPick, setSetsOpenPick] = useState<boolean | null>(null);   // Collapse all / Expand all also fold the bundles
  const [foldGen, setFoldGen] = useState(0);
  const [fold, setFold] = useState<Record<string, boolean>>({});   // what the person chose per team; otherwise finished teams (and every team on a phone) start folded
  const [overview, setOverview] = useState(false);
  const [showList, setShowList] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const steps = useMemo(() => detail?.steps ?? [], [detail?.steps]);
  const counted = useMemo(() => new Set(data.lists.type.filter((t) => t.counted).map((t) => t.value)), [data.lists.type]);
  // Boxes ticked or unticked by a click that is still being saved: shown as already changed (dimmed) so several can be clicked quickly, each saving on its own.
  const [pending, setPending] = useState<Map<string, boolean>>(() => new Map());
  const setPend = (keys: string[], to: boolean | null) => setPending((cur) => { const next = new Map(cur); for (const k of keys) { if (to === null) next.delete(k); else next.set(k, to); } return next; });
  const doneSet = useMemo(() => { const s = new Set((detail?.done ?? []).map(doneKey)); for (const [k, on] of pending) { if (on) s.add(k); else s.delete(k); } return s; }, [detail?.done, pending]);
  const pendingSet = useMemo(() => new Set(pending.keys()), [pending]);
  const doneBy = useMemo(() => new Map((detail?.done ?? []).filter((d) => d.by).map((d) => [doneKey(d), d.by as string])), [detail?.done]);
  const doneAt = useMemo(() => new Map((detail?.done ?? []).map((d) => [doneKey(d), d.done_at])), [detail?.done]);
  const stationOf = useMemo(() => new Map((detail?.stations ?? []).map((s) => [s.id, s])), [detail?.stations]);

  // Devices are always in the order of the Type dropdown (then by ID), whether they are grouped by team or by type.
  const mainTypes = useMemo(() => new Set(data.lists.type.filter((t) => t.main).map((t) => t.value)), [data.lists.type]);
  const typeRank = useMemo(() => new Map(data.lists.type.map((t, i) => [t.value, i])), [data.lists.type]);
  const rankOf = useCallback((type: string) => typeRank.get(type) ?? 9999, [typeRank]);
  const all = useMemo(() => (detail ? planRows(detail, counted) : []), [detail, counted]);
  const rows: Row[] = useMemo(() => {
    if (!detail) return [];
    const order = new Map(detail.stations.map((s) => [s.id, s.sort]));
    // A set (a bundle's parts) is placed by its main device (the PC, laptop or console; else the part listed first) and keeps its own order inside; so a PC set is never named after its keyboard.
    const first = new Map<string, Row>();
    for (const r of all) if (r.setId) { const f = first.get(r.setId); if (!f || primaryRank(r.type, mainTypes) < primaryRank(f.type, mainTypes) || (primaryRank(r.type, mainTypes) === primaryRank(f.type, mainTypes) && r.sort < f.sort)) first.set(r.setId, r); }
    const lead = (r: Row) => (r.setId ? first.get(r.setId) ?? r : r);
    // A sponsor or officer loaner that no row has taken is supply (it shows on its own tab), not part of any team yet.
    return all.filter((r) => r.role === 'planned' && !((r.kind === 'sponsor' || r.kind === 'officer') && !r.requestId && !r.station_id)).sort((a, b) => ((a.station_id ? order.get(a.station_id) ?? 999 : 1000) - (b.station_id ? order.get(b.station_id) ?? 999 : 1000)) || rankOf(lead(a).type) - rankOf(lead(b).type) || natural(lead(a).tag ?? lead(a).type, lead(b).tag ?? lead(b).type) || (a.setId && a.setId === b.setId ? a.sort - b.sort : 0));
  }, [detail, all, rankOf, mainTypes]);
  const backups = useMemo(() => all.filter((r) => r.role === 'backup'), [all]);

  const stepStats = useMemo(() => steps.map((s) => {
    const mine = rows.filter((r) => stepAppliesTo(s, rowKind(r)));
    return { step: s, total: mine.length, done: mine.filter((r) => doneSet.has(`${r.id}:${s.id}`)).length };
  }), [steps, rows, doneSet]);
  const auto = stepStats.find((p) => p.done < p.total)?.step ?? stepStats[stepStats.length - 1]?.step ?? null;
  const step = steps.find((s) => s.id === picked) ?? auto;
  const allDone = stepStats.reduce((n, p) => n + p.done, 0), allTotal = stepStats.reduce((n, p) => n + p.total, 0);
  // Each stage only lists what matters in it: planning looks at teams, empty rows, games, places and double-booked devices; the event day only at what blocks the day (a step skipped, a row with no device, a device in two places).
  const problems = useMemo(() => (detail ? planProblems(rows, detail.stations, steps, doneSet, detail.conflicts, () => null).filter((p) => (day ? ['skipped', 'empty', 'conflict'] : ['empty', 'game', 'place', 'team', 'unrequested', 'conflict']).includes(p.why)) : []), [detail, rows, steps, doneSet, day]);
  const bad = problems.filter((p) => p.sev === 'bad').length, warn = problems.length - bad;

  const isPrizing = page === 'requests-prizing' || page === 'prizing' || page === 'sponsor-prizing';
  const groupByType = byType && page === 'device';   // the same rows, grouped by the kind of device instead of by team
  const teams = useMemo(() => {
    const out: { key: string; station: Station | null; title: string; rows: Row[] }[] = [];
    if (groupByType) {
      for (const r of rows) {
        let g = out.find((x) => x.key === `type:${r.type}`);
        if (!g) { g = { key: `type:${r.type}`, station: null, title: r.type, rows: [] }; out.push(g); }
        g.rows.push(r);
      }
      for (const g of out) g.rows.sort((a, b) => (a.tag ? 0 : 1) - (b.tag ? 0 : 1) || natural(a.tag ?? '', b.tag ?? ''));
      return out.sort((a, b) => rankOf(a.title) - rankOf(b.title) || natural(a.title, b.title));
    }
    for (const s of detail?.stations ?? []) out.push({ key: s.id, station: s, title: s.name, rows: [] });
    for (const r of rows) {
      let g = out.find((x) => x.key === (r.station_id ?? 'none'));
      if (!g) { g = { key: 'none', station: null, title: 'Not On A Team Yet', rows: [] }; out.push(g); }
      g.rows.push(r);
    }
    return out.filter((t) => t.station || t.rows.length);
  }, [detail?.stations, rows, groupByType, rankOf]);

  useEffect(() => {
    const m = window.matchMedia('(max-width: 899px)');
    const sync = () => setNarrow(m.matches);
    sync(); m.addEventListener('change', sync);
    return () => m.removeEventListener('change', sync);
  }, []);

  // After a step is marked: open the team if it is folded, scroll to the device's line and flash it, so the tick is easy to find without a big message.
  function focusRow(rowId: string, teamKey: string) {
    setFold((cur) => ({ ...cur, [teamKey]: false }));
    setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`[data-rows~="${rowId}"]`);
      if (!el) return;
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el.classList.remove(styles.flash); void el.offsetWidth; el.classList.add(styles.flash);
      setTimeout(() => el.classList.remove(styles.flash), 2400);
    }, 80);
  }

  // Undo bar: the last box ticked from the sheet can be taken back for a few seconds.
  const [undoBar, setUndoBar] = useState<{ text: string; undo: () => void } | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function offerUndo(text: string, undo: () => void) {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndoBar({ text, undo });
    undoTimer.current = setTimeout(() => setUndoBar(null), 6000);
  }
  // Offline queue: a tick or untick that couldn't reach the server stays on screen (and on this device) and is sent again when the connection is back.
  interface Queued { key: string; op: 'tick' | 'undo'; body: Record<string, unknown>; item: { id: string; kind: Slim['kind'] }; stepId: string }
  const queueKey = `tg-logistics-queue:${id}`;
  const [queued, setQueued] = useState<Queued[]>([]);
  const queuedRef = useRef<Queued[]>([]);
  const flushing = useRef(false);
  const saveQueue = (list: Queued[]) => { queuedRef.current = list; setQueued(list); try { if (list.length) localStorage.setItem(queueKey, JSON.stringify(list)); else localStorage.removeItem(queueKey); } catch { /* storage blocked */ } };
  function enqueue(q: Queued) { saveQueue([...queuedRef.current.filter((x) => x.key !== q.key), q]); }
  async function flush() {
    if (flushing.current) return;
    flushing.current = true;
    try {
      for (const q of [...queuedRef.current]) {
        let r: 'ok' | 'network' | 'failed' | string;
        if (q.op === 'tick') { const x = await plan.doStep(q.body as Parameters<typeof plan.doStep>[0]); r = x.ok ? 'ok' : x.network ? 'network' : 'failed'; }
        else r = await plan.undoStep(q.item, q.stepId);
        if (r === 'network') break;
        saveQueue(queuedRef.current.filter((x) => x.key !== q.key));
        setPend([q.key], null);
        if (r === 'failed') setFeedback({ tone: 'error', text: 'A change made while offline couldn’t be saved and was undone.' });
      }
    } finally { flushing.current = false; }
  }
  useEffect(() => {   // changes left from before a reload
    try {
      const raw = localStorage.getItem(queueKey);
      if (!raw) return;
      const list = JSON.parse(raw) as Queued[];
      if (!Array.isArray(list) || !list.length) return;
      queuedRef.current = list; setQueued(list);
      setPending((cur) => { const next = new Map(cur); for (const q of list) next.set(q.key, q.op === 'tick'); return next; });
    } catch { /* ignore */ }
  }, [queueKey]);
  useEffect(() => {
    if (!queued.length) return;
    const t = setInterval(() => void flush(), 6000);
    const on = () => void flush();
    window.addEventListener('online', on);
    return () => { clearInterval(t); window.removeEventListener('online', on); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queued.length]);

  async function run(body: { tag?: string; device_id?: string; borrowed_id?: string; slot_id?: string; kit?: { item: string; missing: boolean }[] }, forStep: StepDef | null = step) {
    if (!forStep) return;
    setBusy(true); setError('');
    const r = await plan.doStep({ ...body, step_id: forStep.id });
    setBusy(false);
    if (!r.ok) { setFeedback({ tone: 'error', text: r.error }); return; }
    const res = r.result;
    const name = res.item.tag ?? res.item.type;
    if (res.already) setFeedback({ tone: 'already', text: `${name} was already marked “${forStep.name}” at ${time(res.done_at)}.`, result: res, step: forStep });
    else setFeedback({ tone: 'ok', text: `${name}: ${forStep.name}`, result: res, step: forStep });
    setText(''); setKit(null);
    focusRow(res.item.id, res.station?.id ?? 'none');
    input.current?.focus();
  }
  // Check done (a step that reviews the parts) shows the parts first; the others tick straight away.
  function begin(row: Row | null, forStep: StepDef | null = step, tag?: string) {
    if (!forStep) return;
    let target: Target | null = row;
    if (!row && tag) {
      const b = detail?.borrowed.find((x) => tagKey(x.tag) === tagKey(tag));
      const d = data.devices.find((x) => tagKey(x.tag) === tagKey(tag));
      if (b) target = { id: b.id, kind: b.owner_kind, itemKind: b.owner_kind, tag: b.tag, type: b.type, kit: b.kit };
      else if (d) target = { id: d.id, kind: 'club', itemKind: 'club', tag: d.tag, type: d.type, kit: d.kit };
    }
    if (forStep.kit && target && target.kit.length > 0 && !doneSet.has(`${target.id}:${forStep.id}`)) { setKit({ row: target, flags: Object.fromEntries(target.kit.map((k) => [k.item, k.missing])) }); setPicked(forStep.id); return; }
    void run(row ? bodyOf(row) : { tag }, forStep);
  }
  // A box clicked on the sheet: shown changed at once and saved in the background, so the next box can be clicked straight away.
  async function tick(row: Row, forStep: StepDef) {
    const key = `${row.id}:${forStep.id}`;
    if (pending.has(key)) return;
    if (forStep.kit && row.kit.length > 0 && !doneSet.has(key)) { begin(row, forStep); return; }
    setPend([key], true);
    const body = { ...bodyOf(row), step_id: forStep.id };
    const r = await plan.doStep(body);
    if (!r.ok && r.network) { enqueue({ key, op: 'tick', body, item: { id: row.id, kind: row.kind }, stepId: forStep.id }); return; }
    setPend([key], null);
    if (!r.ok) { setFeedback({ tone: 'error', text: r.error }); return; }
    offerUndo(`${row.tag ?? row.type}: ${forStep.name}`, () => void undo({ id: row.id, kind: row.kind }, forStep.id));
  }
  const submit = () => { if (text.trim() && !busy) begin(null, step, text.trim()); };
  async function undo(item: { id: string; kind: Slim['kind'] }, stepIdToUndo: string) {
    const key = `${item.id}:${stepIdToUndo}`;
    if (pending.has(key)) return;
    setPend([key], false);
    const r = await plan.undoStep(item, stepIdToUndo);
    if (r === 'network') { enqueue({ key, op: 'undo', body: {}, item, stepId: stepIdToUndo }); return; }
    setPend([key], null);
    if (r === 'ok') { setFeedback(null); setUndoBar(null); }
  }
  async function markAll(list: Row[], forStep: StepDef) {
    const todo = list.filter((r) => stepAppliesTo(forStep, rowKind(r)) && !doneSet.has(`${r.id}:${forStep.id}`));
    if (!todo.length) return;
    const keys = todo.map((r) => `${r.id}:${forStep.id}`);
    setError(''); setPend(keys, true);
    const results = await Promise.all(todo.map((r) => plan.doStep({ ...bodyOf(r), step_id: forStep.id })));
    setPend(keys, null);
    const failed = results.filter((x) => !x.ok).length;
    setFeedback(failed ? { tone: 'error', text: `${todo.length - failed} of ${todo.length} marked “${forStep.name}”. ${failed} failed.` } : { tone: 'ok', text: `${todo.length} marked “${forStep.name}”` });
  }

  if (!detail) return <div className={styles.tab}><button type="button" className={styles.back} onClick={onBack}><ArrowLeft size={15} aria-hidden="true" /> All Plans</button>{error ? <Notice tone="error">{error}</Notice> : <Loading variant="inline" label="Loading…" />}</div>;

  const { plan: p, canManage, stations, borrowed, extras } = detail;
  const closed = p.status === 'closed';
  const manage = canManage && !closed && !day;   // the event day only keeps track (ticks and swaps); rows, teams and prizes are changed in Allocation
  const fb = feedback, res = fb?.result;
  const resStation = res?.station ? stationOf.get(res.station.id) : null;
  const pct = allTotal ? Math.round((allDone / allTotal) * 100) : 0;
  const emptyRows = rows.filter((r) => r.kind === 'slot' && !r.counted);
  // The IDs that can still be typed into a row: usable devices of that type that are not in this plan yet (the browser suggests them as you type).
  const listId = (type: string) => `ids-${type.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const inPlan = new Set(detail.items.map((i) => i.device_id));
  const free = new Map<string, string[]>();
  for (const dv of data.devices) if (dv.tag && !inPlan.has(dv.id) && isUsable(dv)) free.set(dv.type, [...(free.get(dv.type) ?? []), dv.tag]);
  for (const b of borrowed) if (b.role === 'planned' && !b.request_id && !b.station_id) free.set(b.type, [...(free.get(b.type) ?? []), b.tag]);
  const ctx: SheetCtx = {
    listId, setsOpen: setsOpenPick ?? !day, foldGen, byType: groupByType,
    api: plan, canManage: canManage && !day, manager: canManage, closed, busy, pending: pendingSet, main: mainTypes, day, stations, steps, activeId: step?.id ?? '', doneSet, doneAt, doneBy, problems,
    onTick: (row, s) => void tick(row, s), onTickAll: (list, s) => void markAll(list, s), onUndo: undo, onSwap: (r) => setSwapping({ id: r.id, tag: r.tag, type: r.type, kind: r.kind === 'slot' ? 'club' : r.kind }),
    onBorrowed: (r) => setBorrowing(borrowed.find((b) => b.id === r.id) ?? null), onInstalled: (list) => void install(list), onEditDevice: (r) => setDeviceEdit(catalog.data?.devices.find((x) => x.id === r.id) ?? data.devices.find((x) => x.id === r.id) ?? null),
  };
  const foldOf = (key: string, complete: boolean) => (key in fold ? fold[key] : complete || narrow);
  const toggleFold = (key: string, complete: boolean) => setFold((cur) => ({ ...cur, [key]: !foldOf(key, complete) }));
  const allFolded = teams.length > 0 && teams.every((t) => { const tot = steps.reduce((n, st) => n + t.rows.filter((r) => stepAppliesTo(st, rowKind(r))).length, 0); const dn = steps.reduce((n, st) => n + t.rows.filter((r) => stepAppliesTo(st, rowKind(r)) && doneSet.has(`${r.id}:${st.id}`)).length, 0); return foldOf(t.key, tot > 0 && dn === tot); });
  const jump = (sid: string | null) => { if (!sid) return; setFold((cur) => ({ ...cur, [sid]: false })); setTimeout(() => document.getElementById(`st-${sid}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0); };

  // The games a row needs that its device doesn't list yet are added to the device's installed games (the same list as in Equipment, with its history line).
  async function install(list: Row[]) {
    setBusy(true); setError('');
    for (const r of list) {
      if (r.kind === 'slot') continue;
      const miss = r.games_needed.filter((g) => !r.games.some((x) => x.toLowerCase() === g.toLowerCase()));
      if (!miss.length) continue;
      if (r.kind === 'club') await catalog.saveDevice(r.id, { games: [...r.games, ...miss] });
      else await plan.act('/borrowed', 'PATCH', { borrowed_id: r.id, games: [...r.games, ...miss] });
    }
    await plan.reload();
    setBusy(false);
  }

  async function remove() {
    if (!(await confirmHold({ title: `Remove “${p.name}”?`, message: 'The plan, its teams, the devices in it (including any borrowed ones) and every step recorded for it are deleted. The inventory itself is not touched.', confirmLabel: 'Hold to remove' }))) return;
    if (await act('', 'DELETE')) onBack();
  }
  async function removeStation(s: Station) {
    if (!(await confirmHold({ title: `Remove ${s.name}?`, message: 'Its rows are removed with it. The devices themselves stay in the inventory.', confirmLabel: 'Hold to remove' }))) return;
    await act('/stations', 'DELETE', { station_id: s.id });
  }

  return (
    <div className={styles.dayPage}>
      <div className={styles.dayTop}>
        <div className={styles.dayBar}>
          <button type="button" className={styles.back} onClick={onBack}><ArrowLeft size={15} aria-hidden="true" /> All Events</button>
          <div className={styles.dayHeading}>
            <b className={styles.dayTitle}>{p.name}{closed && <span className={`${styles.badge} ${styles.neutral}`}>Closed</span>}</b>
            <span className={styles.muted}>{range(p.starts_on, p.ends_on)}{p.event_id ? ' · portal event' : ' · Event logistics only'}{p.notes ? ` · ${p.notes}` : ''}</span>
          </div>
          {page === 'device' && day && <span className={styles.dayTotal} title="Steps done"><span className={styles.bar}><i style={{ width: `${pct}%` }} /></span>{allDone}/{allTotal}</span>}
          <DeviceFinder rows={all} devices={data.devices} stations={stations} steps={steps} doneSet={doneSet} onGo={(r) => { if (page !== 'device') onPage('device', day); setTimeout(() => focusRow(r.id, groupByType ? `type:${r.type}` : r.stationId ?? 'none'), page !== 'device' ? 400 : 0); }} />
          <button type="button" className={styles.iconBtn} onClick={() => void plan.reload()} aria-label="Refresh"><RefreshCw size={15} aria-hidden="true" /></button>
          {canManage && (
            <details className={styles.menu}>
              <summary aria-label="More actions" title="More"><MoreHorizontal size={16} aria-hidden="true" /></summary>
              <div className={styles.menuList}>
                <button type="button" onClick={() => setEditing(true)}>Edit Name And Dates</button>
                <button type="button" onClick={() => void act('', 'PATCH', { status: closed ? 'draft' : 'closed' })}>{closed ? 'Reopen Plan' : 'Close Plan'}</button>
                <button type="button" className={styles.menuDanger} onClick={remove}>Remove Plan</button>
              </div>
            </details>
          )}
        </div>
        {[...free].map(([type, tags]) => <datalist key={type} id={listId(type)}>{tags.sort(natural).map((t) => <option key={t} value={t} />)}</datalist>)}
        <div className={styles.pageBar}>
        <SectionTabs<'devices' | 'prizing'> variant="segmented" label="Devices or prizing" value={isPrizing ? 'prizing' : 'devices'}
          onChange={(g) => onPage(g === 'prizing' ? 'requests-prizing' : 'requests')} tabs={[{ id: 'devices', label: 'Devices' }, { id: 'prizing', label: 'Prizing' }]} />
        <SectionTabs<string> variant="segmented" label="Event pages" value={page === 'requests' || page === 'requests-prizing' ? page : `${day && (page === 'device' || page === 'prizing') ? 'day' : 'alloc'}-${page}`}
          onChange={(v) => v === 'requests' || v === 'requests-prizing' ? onPage(v) : onPage(v.replace(/^(day|alloc)-/, '') as EventPage, v.startsWith('day-'))} tabs={isPrizing ? [
            { id: 'requests-prizing', label: 'Requests' },
            { id: 'alloc-sponsor-prizing', label: 'Sponsor Prizing' },
            { id: 'alloc-prizing', label: 'Allocation', count: detail.prizes.lines.length },
            { id: 'day-prizing', label: 'Event Day' },
          ] : [
            { id: 'requests', label: 'Requests' },
            { id: 'alloc-sponsor-loaners', label: 'Sponsor Loaners', count: borrowed.filter((b) => b.owner_kind === 'sponsor').length },
            { id: 'alloc-officer-loaners', label: 'Officer Loaners', count: borrowed.filter((b) => b.owner_kind === 'officer').length },
            { id: 'alloc-device', label: 'Allocation', count: rows.length },
            { id: 'day-device', label: 'Event Day' },
          ]} />
        </div>
        {page === 'device' && day && !closed && (
          <div className={styles.dayStick}>
            <form className={styles.dayForm} onSubmit={(e) => { e.preventDefault(); submit(); }}>
            <select className={styles.daySelect} value={picked} onChange={(e) => { setPicked(e.target.value); setKit(null); input.current?.focus(); }} aria-label="Step to mark when typing an ID">
              <option value="">Next step: {auto?.name ?? '–'}</option>
              {stepStats.map((s) => <option key={s.step.id} value={s.step.id}>{s.step.name} ({s.done}/{s.total})</option>)}
            </select>
            <datalist id="day-ids">{all.filter((r) => r.kind !== 'slot' && r.tag).map((r) => <option key={r.id} value={r.tag!}>{`${r.type}${r.stationId ? ` · ${stationOf.get(r.stationId)?.name ?? ''}` : ''}`}</option>)}</datalist>
            <input ref={input} list="day-ids" className={styles.dayInput} value={text} onChange={(e) => setText(e.target.value)} placeholder={`Type an ID to mark “${step?.name ?? 'the step'}”`} aria-label={`Device ID for ${step?.name ?? 'the step'}`} autoCapitalize="characters" autoComplete="off" autoCorrect="off" spellCheck={false} enterKeyHint="done" disabled={busy || !step} />
            <Button type="submit" disabled={!text.trim() || busy} loading={busy}>Mark</Button>
          </form>
            {fb && (
              <div className={`${styles.lastBar} ${fb.tone === 'ok' ? styles.lastOk : fb.tone === 'already' ? styles.lastWarn : styles.lastBad}`} role="status" aria-live="polite">
                <b>{fb.text}</b>
                {res && <span>Get it: {whereOf(res.item) === 'No place set' ? <b className={styles.notLocated}>Not located yet</b> : <b>{whereOf(res.item)}</b>}{res.item.place_note ? ` · ${res.item.place_note}` : ''}</span>}
                {res?.station ? <span>Goes to <b>{res.station.name}</b>{resStation?.room ? ` · ${resStation.room}` : ''}{resStation?.contact ? ` · ${resStation.contact}` : ''}</span> : res?.inPlan ? <span className={styles.dim}>No team yet</span> : null}
                {res && !res.inPlan && <span className={styles.flagWarn}>Not in this plan; recorded anyway{canManage ? '' : '. Ask logistics to add it'}</span>}
                <span className={styles.lastActions}>
                  {res && fb.tone !== 'error' && fb.step && <button type="button" className={styles.linkBtn} onClick={() => void undo(res.item, fb.step!.id)}>Undo</button>}
                  {canManage && res && res.inPlan && res.role === 'planned' && res.item.kind !== 'slot' && <button type="button" className={styles.linkBtn} onClick={() => setSwapping({ id: res.item.id, tag: res.item.tag, type: res.item.type, kind: res.item.kind as 'club' | 'sponsor' | 'officer' })}>Swap</button>}
                  {res && !res.inPlan && canManage && res.item.kind === 'club' && <><button type="button" className={styles.linkBtn} onClick={() => void act('/devices', 'POST', { device_ids: [res.item.id] })}>Add To Plan</button><button type="button" className={styles.linkBtn} onClick={() => void act('/devices', 'POST', { device_ids: [res.item.id], role: 'backup' })}>Add As Backup</button></>}
                  <button type="button" className={styles.linkBtn} onClick={() => setFeedback(null)} aria-label="Dismiss">Dismiss</button>
                </span>
              </div>
            )}
          </div>
        )}
        {page === 'device' && day && closed && <Notice tone="error">This event is closed, so nothing more can be recorded.</Notice>}
      </div>
      {error && <div role="alert" onClick={() => setError('')}><Notice tone="error">{error}</Notice></div>}
      {deviceEdit && <DeviceDialog api={catalog} data={data} device={deviceEdit} onClose={() => { setDeviceEdit(null); void plan.reload(); }} />}
      {swapping && <SwapDialog plan={plan} options={[...(free.get(swapping.type) ?? [])].sort(natural)} device={swapping} onClose={() => setSwapping(null)} />}
      {borrowing && <BorrowedDialog plan={plan} catalog={catalog} data={data} borrowed={borrowing === 'new' ? null : borrowing} onClose={() => setBorrowing(null)} />}
      {editing && <EditPlanDialog plan={plan} onClose={() => setEditing(false)} />}
      {stationDialog && !stationDialog.station && <StationDialog plan={plan} station={null} onClose={() => setStationDialog(null)} />}
      {filling && !filling.station && <FillDialog plan={plan} station={null} onClose={() => setFilling(null)} />}

      {page === 'prizing' && <PrizingTab plan={plan} api={catalog} data={data} day={day} />}
      {page === 'sponsor-prizing' && <SponsorPrizingTab plan={plan} api={catalog} data={data} />}
      {page === 'sponsor-loaners' && <BorrowedTab plan={plan} catalog={catalog} data={data} kind="sponsor" />}
      {page === 'officer-loaners' && <BorrowedTab plan={plan} catalog={catalog} data={data} kind="officer" />}
      {(page === 'requests' || page === 'requests-prizing') && <RequestsTab key={page} kind={page === 'requests' ? 'devices' : 'prizes'} plan={plan} api={catalog} data={data} />}

      {page === 'device' && <div className={styles.dayLayout}>
        {kit && <div className={styles.dayAside}>
          {kit && step && (
            <div className={styles.kitPanel} role="group" aria-label={`Parts of ${kit.row.tag}`}>
              <b>{kit.row.tag} · {kit.row.type}</b>
              <p className={styles.muted}>Check each part is there, then press Mark. Tap a part to flag it missing.</p>
              <ul className={styles.kitList}>
                {kit.row.kit.map((k) => (
                  <li key={k.item} className={`${styles.kitLine} ${kit.flags[k.item] ? styles.kitMissing : ''}`}>
                    <span className={styles.kitName}>{k.item}{k.qty > 1 ? ` ×${k.qty}` : ''}</span>
                    <button type="button" className={`${styles.missBtn} ${kit.flags[k.item] ? styles.missOn : ''}`} aria-pressed={kit.flags[k.item]} onClick={() => setKit({ ...kit, flags: { ...kit.flags, [k.item]: !kit.flags[k.item] } })}>{kit.flags[k.item] ? 'Missing' : 'Present'}</button>
                  </li>
                ))}
              </ul>
              <div className={styles.resultActions}>
                <Button onClick={() => void run({ ...bodyOf(kit.row), kit: kit.row.kit.map((k) => ({ item: k.item, missing: !!kit.flags[k.item] })) })} loading={busy}>Mark {step.name}</Button>
                <Button variant="ghost" onClick={() => { setKit(null); input.current?.focus(); }} disabled={busy}>Cancel</Button>
              </div>
            </div>
          )}
        </div>}

        <div className={styles.dayMain}>
          {rows.length > 0 && (
            <section className={`${styles.statusBar} ${bad ? styles.readyBad : warn ? styles.readyWarn : styles.readyOk}`} aria-label="What needs fixing">
              <div className={`${styles.readyHead} ${problems.length > 0 ? styles.clickRow : ''}`} onClick={(e) => { if (problems.length > 0 && !interactive(e.target)) setShowList((v) => !v); }} role={problems.length > 0 ? 'button' : undefined} tabIndex={problems.length > 0 ? 0 : undefined} aria-expanded={problems.length > 0 ? showList : undefined} onKeyDown={(e) => { if (problems.length > 0 && (e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); setShowList((v) => !v); } }}>
                <b>{bad || warn ? `${problems.length} to fix` : 'Everything is ready'}</b>
                {bad > 0 && <span className={`${styles.badge} ${styles.bad}`}>{bad} wrong</span>}
                {warn > 0 && <span className={`${styles.badge} ${styles.warnBadge}`}>{warn} to check</span>}
                {problems.length > 0 && <span className={styles.dim}>{showList ? 'Click to hide the list' : 'Click to see the list'}</span>}
                <span className={styles.statusSpacer} />
                {page === 'device' && (
                  <span className={styles.miniSeg} role="group" aria-label="Group the devices">
                    <button type="button" aria-pressed={!byType} onClick={() => onGroup(false)}>By Team</button>
                    <button type="button" aria-pressed={byType} onClick={() => onGroup(true)}>By Type</button>
                  </span>
                )}
                {manage && emptyRows.length > 0 && <button type="button" className={styles.linkBtn} onClick={() => setFilling({ station: null })}>Fill {emptyRows.length} Empty</button>}
                {day && <button type="button" className={styles.linkBtn} aria-expanded={overview} onClick={() => setOverview((v) => !v)}>{overview ? 'Hide overview' : 'Overview'}</button>}
                <button type="button" className={styles.linkBtn} onClick={() => { setFold(Object.fromEntries(teams.map((t) => [t.key, !allFolded]))); setSetsOpenPick(allFolded); setFoldGen((g) => g + 1); }}>{allFolded ? 'Expand all' : 'Collapse all'}</button>
              </div>
              {showList && problems.length > 0 && (
                <ul className={styles.problemList}>
                  {problems.map((pr, i) => (
                    <li key={i} className={pr.sev === 'bad' ? styles.problemBad : styles.problemWarn}>
                      <span>{pr.text}</span>
                      {groupByType
                        ? (() => { const t = rows.find((x) => x.id === pr.row_id)?.type; return t ? <button type="button" className={styles.linkBtn} onClick={() => jump(`type:${t}`)}>Go to type</button> : null; })()
                        : pr.station_id && <button type="button" className={styles.linkBtn} onClick={() => jump(pr.station_id)}>Go to team</button>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
          {day && overview && (
            <div className={styles.overviewWrap}>
              <p className={styles.overviewHelp}>Each block is a team, each line a device (a bundle is one line: click it to open its parts). Click a box to tick a step and again to undo, or type a device’s ID above and press Mark. “Mark all” ticks the picked step for a team. Red and amber lines need a look.</p>
              <table className={styles.overview}>
                <thead><tr><th scope="col">Team</th>{steps.map((s) => <th key={s.id} scope="col">{s.name}</th>)}</tr></thead>
                <tbody>
                  {teams.map((t) => (
                    <tr key={t.key}>
                      <th scope="row"><button type="button" className={styles.linkBtn} onClick={() => jump(t.key)}>{t.title}</button></th>
                      {steps.map((s) => {
                        const m = t.rows.filter((r) => stepAppliesTo(s, rowKind(r)));
                        const d = m.filter((r) => doneSet.has(`${r.id}:${s.id}`)).length;
                        return <td key={s.id} className={m.length === 0 ? styles.ovNa : d === m.length ? styles.ovDone : d > 0 ? styles.ovPart : ''}>{m.length === 0 ? '–' : `${d}/${m.length}`}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {rows.length === 0 && backups.length === 0 && (
            <>
              <HowItWorks id="plan-empty" startOpen>
                <ol className={styles.helpSteps}>
                  <li><b>Add teams.</b> “Add Teams And Devices” makes them from a bundle (like five PC stations) with a device in every row.</li>
                  <li><b>Check the sheet.</b> Red and amber lines need a look. Give an empty row a device by typing its ID.</li>
                  <li><b>On the day,</b> tick the step boxes here, or type IDs above.</li>
                </ol>
              </HowItWorks>
              <div className={styles.empty}><p>{canManage ? 'No teams yet. Start with “Add Teams And Devices”.' : 'No teams have been added to this plan yet.'}</p></div>
            </>
          )}

          {teams.map((t) => {
            const mineStats = steps.map((s) => {
              const m = t.rows.filter((r) => stepAppliesTo(s, rowKind(r)));
              return { s, total: m.length, done: m.filter((r) => doneSet.has(`${r.id}:${s.id}`)).length };
            });
            const total = mineStats.reduce((n, x) => n + x.total, 0), done = mineStats.reduce((n, x) => n + x.done, 0);
            const complete = total > 0 && done === total;
            const folded = foldOf(t.key, day && complete);
            const s = t.station;
            const status = s ? stationStatus(problems, s.id) : 'ok';
            const mine = s ? problems.filter((x) => x.station_id === s.id) : [];
            const emptyHere = t.rows.filter((r) => r.kind === 'slot' && !r.counted).length;
            return (
              <section key={t.key} id={`st-${t.key}`} className={`${styles.dayTeam} ${day ? '' : styles.noSteps} ${day && complete ? styles.dayTeamDone : ''}`} style={{ '--n': steps.length } as React.CSSProperties} aria-label={t.title}>
                <div className={`${styles.dayRow} ${styles.dayRowHead} ${styles.clickRow}`} onClick={(e) => { if (!interactive(e.target)) toggleFold(t.key, complete); }}>
                  <div className={styles.teamHeadMain}>
                    <div className={styles.teamLine}>
                      <button type="button" className={styles.foldBtn} aria-expanded={!folded} onClick={() => toggleFold(t.key, complete)}>
                        <span className={styles.foldMark} aria-hidden="true">{folded ? '+' : '–'}</span>
                        <b>{t.title}</b>
                      </button>
                      {s && <span className={`${styles.statusChip} ${status === 'ok' ? styles.chipOk : status === 'bad' ? styles.chipBad : styles.chipWarn}`}>{status === 'ok' ? 'Ready' : `${mine.length} to fix`}</span>}
                      {day && <span className={complete ? styles.dTeamDone : styles.dTeamNum}>{complete ? 'All done' : `${done}/${total}`}</span>}
                    </div>
                    {s && (
                      <div className={styles.teamLine}>
                        <span className={styles.dTeamSub}>{s.contact ?? <span className={styles.warnText}>No contact</span>} · {s.room ?? <span className={styles.warnText}>No room</span>}</span>
                      </div>
                    )}
                    {!folded && (
                      <div className={styles.teamLine}>
                        {manage && s && (
                          <details className={`${styles.menu} ${styles.teamMenu}`}>
                            <summary aria-label={`More for ${s.name}`} title="More"><MoreHorizontal size={16} aria-hidden="true" /></summary>
                            <div className={styles.menuList}>
                              {emptyHere > 0 && <button type="button" onClick={() => setFilling({ station: s })}>Fill {emptyHere} Empty</button>}
                              <button type="button" onClick={() => setStationDialog({ station: s })}>Edit Team</button>
                              <button type="button" className={styles.menuDanger} onClick={() => void removeStation(s)}>Remove Team</button>
                            </div>
                          </details>
                        )}
                      </div>
                    )}
                  </div>
                  {day && <div className={styles.dHeads}>
                    {mineStats.map((x) => (
                      <button key={x.s.id} type="button" className={`${styles.dHead} ${step?.id === x.s.id ? styles.dHeadOn : ''} ${x.total > 0 && x.done === x.total ? styles.dHeadDone : ''}`} onClick={() => { setPicked(x.s.id); setKit(null); input.current?.focus(); }} title={`Type IDs for “${x.s.name}”`}>
                        <span>{x.s.name}</span><small>{x.done}/{x.total}</small>
                      </button>
                    ))}
                  </div>}
                </div>
                {s && stationDialog?.station?.id === s.id && <StationDialog plan={plan} station={s} onClose={() => setStationDialog(null)} />}
                {s && filling?.station?.id === s.id && <FillDialog plan={plan} station={s} onClose={() => setFilling(null)} />}
                {!folded && t.rows.length > 0 && <div className={`${styles.dayRow} ${styles.colHead}`} aria-hidden="true"><span>Device</span><span>Games, notes and problems</span>{day && <span />}<span /></div>}
                {!folded && (t.rows.length === 0 ? <p className={styles.teamEmpty}>No rows yet. They come from this team’s requests.</p> : <SheetRows rows={t.rows} ctx={ctx} />)}
              </section>
            );
          })}

          {page === 'device' && free.size > 0 && (
            <details className={styles.freeBox}>
              <summary>Not Allocated <span className={styles.dim}>{[...free.values()].reduce((n, l) => n + l.length, 0)} devices still free</span></summary>
              <div className={styles.freeGroups}>
                {[...free].sort((a, b) => rankOf(a[0]) - rankOf(b[0]) || natural(a[0], b[0])).map(([type, tags]) => (
                  <div key={type} className={styles.freeGroup}>
                    <b>{type} <span className={styles.dim}>{tags.length}</span></b>
                    <span className={styles.freeTags}>{[...tags].sort(natural).map((t) => <span key={t} className={styles.freeTag}>{t}</span>)}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
          {backups.length > 0 && (
            <section className={styles.dayTeam} style={{ '--n': steps.length } as React.CSSProperties} aria-label="Backups">
              <div className={`${styles.dayRow} ${styles.dayRowHead}`}><div className={styles.teamHeadMain}><b>Backups <span className={styles.dim}>{backups.length}</span></b></div></div>
              <SheetRows rows={backups} ctx={ctx} backup />
            </section>
          )}

          {extras.length > 0 && (
            <section className={styles.panel} aria-label="Not in plan">
              <h3 className={styles.panelTitle}>Used But Not In The Plan <span className={styles.dim}>{extras.length}</span></h3>
              <p className={styles.muted}>These were ticked on the day but nobody planned them. Add them so the record is complete.</p>
              <ul className={styles.planList}>{extras.map((d) => (
                <li key={d.id} className={styles.planRow}>
                  <div className={styles.planRowMain}><b className={styles.planTag}>{d.tag ?? d.type}</b><span className={styles.planSub}>{d.type}{d.name ? ` · ${d.name}` : ''}</span></div>
                  {manage && <div className={styles.planRowSide}><Button size="sm" variant="secondary" onClick={() => void act('/devices', 'POST', { device_ids: [d.id], role: 'backup' })}>Add As Backup</Button><Button size="sm" variant="secondary" onClick={() => void act('/devices', 'POST', { device_ids: [d.id] })}>Add To Plan</Button></div>}
                </li>
              ))}</ul>
            </section>
          )}
        </div>
      </div>}

      {(undoBar || queued.length > 0) && (
        <div className={styles.undoBar} role="status" aria-live="polite">
          {queued.length > 0
            ? <><span>{queued.length} change{queued.length === 1 ? '' : 's'} waiting to send. Saved on this device.</span><button type="button" className={styles.undoBtn} onClick={() => void flush()}>Send Now</button></>
            : undoBar && <><span>{undoBar.text}</span><button type="button" className={styles.undoBtn} onClick={() => { undoBar.undo(); setUndoBar(null); }}>Undo</button></>}
        </div>
      )}
    </div>
  );
}

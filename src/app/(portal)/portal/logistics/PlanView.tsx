'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowLeftRight, Camera, Minus, Plus, RefreshCw } from 'lucide-react';
import dynamic from 'next/dynamic';
import { registerScanHandler } from '@/lib/portal/scanHandlers';
const UniversalScanner = dynamic(() => import('@/components/portal/UniversalScanner'), { ssr: false });   // the camera is only loaded when it is opened
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import Loading from '@/components/Loading/Loading';
import { tagKey } from '@/lib/logistics/devices';
import { groupRows, groupTitles, type DeviceGroup } from '@/lib/logistics/deviceGroups';
import { impliedDone, isUsable, natural, planProblems, rowKind, stationStatus, stepAppliesTo, type StepDef } from '@/lib/logistics/plans';
import BorrowedDialog from './BorrowedDialog';
import DeviceDialog from './DeviceDialog';
import type { Device } from '@/lib/logistics/devices';
import HowItWorks from './HowItWorks';
import { interactive } from './interactive';
import { FillDialog, StationDialog } from './PlanDialogs';
import BorrowedTab from './BorrowedTab';
import DeviceFinder from './DeviceFinder';
import RequestsTab, { useRequests } from './RequestsTab';
import SectionTabs from '@/components/ui/SectionTabs';
import type { EventPage } from './logisticsRoute';
import { SheetRows, type SheetCtx } from './PlanSheet';
import SwapDialog from './SwapDialog';
import { planRows, primaryRank, type Row } from './planRows';
import { TextCell } from './Cells';
import { usePrizes } from './usePrizes';
import { doneKey, usePlan, type Borrowed, type Slim, type Station, type StepResult } from './usePlans';
import type { Catalog, LogisticsApi } from './useLogistics';
import { Combo, Suggest } from './Combo';
import { RowMenu } from './RowMenu';
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

export default function PlanView({ id, data, catalog, page, day, group, embedded, accordion = false, onOpenPrizing, onOpenDevices, openOnly, onOpenOnly, onPage, onBack }: { group: DeviceGroup; embedded?: boolean; accordion?: boolean; onOpenDevices?: () => void; onOpenPrizing: () => void; openOnly: boolean; onOpenOnly: (v: boolean) => void; id: string; data: Catalog; catalog: LogisticsApi; page: EventPage; day: boolean; onPage: (p: EventPage, day?: boolean) => void; onBack: () => void }) {
  const plan = usePlan(id, true);
  const prizeInv = usePrizes();
  const { detail, error, setError, act } = plan;
  const [picked, setPicked] = useState('');   // '' = follow the work
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [scanning, setScanning] = useState(false);   // the portal's scanner opened from this page (a tablet or laptop with a camera; on a phone the Scan button of the bottom bar does the same)
  // Parts flagged missing on the sheet before Check done is pressed (row id → part → missing); they are sent with that tap. Once Check done is done, a tap on a part saves at once.
  const [kitFlags, setKitFlags] = useState<Record<string, Record<string, boolean>>>({});
  const [swapping, setSwapping] = useState<{ id: string; tag: string | null; type: string; kind: 'club' | 'sponsor' | 'officer' } | null>(null);
  const [borrowing, setBorrowing] = useState<Borrowed | 'new' | null>(null);
  const [deviceEdit, setDeviceEdit] = useState<Device | null>(null);   // a device's own information, changed here instead of in the inventory
  const [stationDialog, setStationDialog] = useState<{ station: Station | null } | null>(null);
  const [filling, setFilling] = useState<{ station: Station | null } | null>(null);
  const [setsOpenPick, setSetsOpenPick] = useState<boolean | null>(null);   // Collapse all / Expand all also fold the bundles
  const [foldGen, setFoldGen] = useState(0);
  const [fold, setFold] = useState<Record<string, boolean>>({});   // what the person chose per team; otherwise finished teams (and every team on a phone) start folded
  const [overview, setOverview] = useState(false);
  const [showList, setShowList] = useState(false);
  const [narrow, setNarrow] = useState(false);
  // The phone's keyboard: how much of the screen it covers, so the ID bar pinned at the bottom rides on top of it.
  const [kb, setKb] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const f = () => setKb(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)));
    f(); vv.addEventListener('resize', f); vv.addEventListener('scroll', f);
    return () => { vv.removeEventListener('resize', f); vv.removeEventListener('scroll', f); };
  }, []);
  const input = useRef<HTMLInputElement>(null);

  const steps = useMemo(() => detail?.steps ?? [], [detail?.steps]);
  const counted = useMemo(() => new Set(data.lists.type.filter((t) => t.counted).map((t) => t.value)), [data.lists.type]);
  // Boxes ticked or unticked by a click that is still being saved: shown as already changed (dimmed) so several can be clicked quickly, each saving on its own.
  const [pending, setPending] = useState<Map<string, boolean>>(() => new Map());
  const setPend = (keys: string[], to: boolean | null) => setPending((cur) => { const next = new Map(cur); for (const k of keys) { if (to === null) next.delete(k); else next.set(k, to); } return next; });
  const realDone = useMemo(() => { const s = new Set((detail?.done ?? []).map(doneKey)); for (const [k, on] of pending) { if (on) s.add(k); else s.delete(k); } return s; }, [detail?.done, pending]);
  const pendingSet = useMemo(() => new Set(pending.keys()), [pending]);
  const doneBy = useMemo(() => new Map((detail?.done ?? []).filter((d) => d.by).map((d) => [doneKey(d), d.by as string])), [detail?.done]);
  const doneAt = useMemo(() => new Map((detail?.done ?? []).map((d) => [doneKey(d), d.done_at])), [detail?.done]);
  const stationOf = useMemo(() => new Map((detail?.stations ?? []).map((s) => [s.id, s])), [detail?.stations]);

  // Devices are always in the order of the Type dropdown (then by ID), whether they are grouped by team or by type.
  const mainTypes = useMemo(() => new Set(data.lists.type.filter((t) => t.main).map((t) => t.value)), [data.lists.type]);
  const typeRank = useMemo(() => new Map(data.lists.type.map((t, i) => [t.value, i])), [data.lists.type]);
  const rankOf = useCallback((type: string) => typeRank.get(type) ?? 9999, [typeRank]);
  // The rows only depend on the devices, loaners and empty rows, not on which steps are done or the prize counts, so a tick doesn't build them (and what is sorted from them) again.
  const all = useMemo(() => (detail ? planRows(detail, counted) : []), [detail?.items, detail?.borrowed, detail?.slots, counted]);   // eslint-disable-line react-hooks/exhaustive-deps
  const dayIds = useMemo(() => all.filter((r) => r.kind !== 'slot' && r.tag).map((r) => ({ value: r.tag!, hint: `${r.type}${r.stationId ? ` · ${stationOf.get(r.stationId)?.name ?? ''}` : ''}` })), [all, stationOf]);
  const rows: Row[] = useMemo(() => {
    if (!detail) return [];
    const order = new Map(detail.stations.map((s) => [s.id, s.sort]));
    // A set (a bundle's parts) is placed by its main device (the PC, laptop or console; else the part listed first) and keeps its own order inside; so a PC set is never named after its keyboard.
    const first = new Map<string, Row>();
    for (const r of all) if (r.setId) { const f = first.get(r.setId); if (!f || primaryRank(r.type, mainTypes) < primaryRank(f.type, mainTypes) || (primaryRank(r.type, mainTypes) === primaryRank(f.type, mainTypes) && r.sort < f.sort)) first.set(r.setId, r); }
    const lead = (r: Row) => (r.setId ? first.get(r.setId) ?? r : r);
    // A sponsor or officer loaner that no row has taken is supply (it shows on its own tab), not part of any team yet.
    return all.filter((r) => r.role === 'planned' && !((r.kind === 'sponsor' || r.kind === 'officer') && !r.requestId && !r.station_id)).sort((a, b) => ((a.station_id ? order.get(a.station_id) ?? 999 : 1000) - (b.station_id ? order.get(b.station_id) ?? 999 : 1000)) || rankOf(lead(a).type) - rankOf(lead(b).type) || natural(lead(a).tag ?? lead(a).type, lead(b).tag ?? lead(b).type) || (a.setId && a.setId === b.setId ? a.sort - b.sort : 0));
  }, [detail?.stations, all, rankOf, mainTypes]);   // eslint-disable-line react-hooks/exhaustive-deps
  const backups = useMemo(() => all.filter((r) => r.role === 'backup'), [all]);
  // A step skipped before a later one that was ticked is taken as done (shown as a soft check, counted in the totals), never flagged as a problem.
  const doneSet = useMemo(() => new Set([...realDone, ...impliedDone(all, steps, realDone)]), [realDone, all, steps]);

  const stepStats = useMemo(() => steps.map((s) => {
    const mine = rows.filter((r) => stepAppliesTo(s, rowKind(r)));
    return { step: s, total: mine.length, done: mine.filter((r) => doneSet.has(`${r.id}:${s.id}`)).length };
  }), [steps, rows, doneSet]);
  const stepLabel = (s: { step: { name: string }; done: number; total: number } | undefined) => (s ? `${s.step.name} (${s.done}/${s.total})` : null);
  const auto = stepStats.find((p) => p.done < p.total)?.step ?? stepStats[stepStats.length - 1]?.step ?? null;
  const step = steps.find((s) => s.id === picked) ?? auto;
  const allDone = stepStats.reduce((n, p) => n + p.done, 0), allTotal = stepStats.reduce((n, p) => n + p.total, 0);
  // Each stage only lists what matters in it: planning looks at teams, empty rows, games, places and double-booked devices; the event day only at what blocks the day (a row with no device, a device in two places).
  const problems = useMemo(() => (detail ? planProblems(rows, detail.stations, steps, doneSet, detail.conflicts, () => null).filter((p) => (day ? ['empty', 'conflict'] : ['empty', 'game', 'place', 'team', 'unrequested', 'conflict']).includes(p.why) && !(day && p.part)) : []), [detail, rows, steps, doneSet, day]);
  const bad = problems.filter((p) => p.sev === 'bad').length, warn = problems.length - bad;

  const requests = useRequests(detail?.plan.id ?? '', page === 'requests' || page === 'requests-prizing');
  const isPrizing = page === 'requests-prizing';
  const grouped = group !== 'station' && page === 'device';   // the same rows, grouped by something other than the team
  const teams = useMemo(() => {
    const out: { key: string; station: Station | null; title: string; rows: Row[] }[] = [];
    if (grouped) {
      const attention = new Set(problems.map((p) => p.row_id).filter(Boolean) as string[]);
      const full = (r: Row) => steps.every((st) => !stepAppliesTo(st, rowKind(r)) || doneSet.has(`${r.id}:${st.id}`));
      const gs = groupRows(rows, group as Exclude<DeviceGroup, 'station'>, { attention: (r) => attention.has(r.id) || (r.kind === 'slot' && !(r as Row).counted), complete: (r) => full(r as Row), day }, rankOf);
      for (const g of gs) out.push({ key: `${group}:${g.title}`, station: null, title: g.title, rows: [...g.rows].sort((a, b) => group === 'type' || group === 'none' ? (a.tag ? 0 : 1) - (b.tag ? 0 : 1) || natural(a.tag ?? '', b.tag ?? '') : 0) });
      return out;
    }
    for (const s of detail?.stations ?? []) out.push({ key: s.id, station: s, title: s.name, rows: [] });
    for (const r of rows) {
      let g = out.find((x) => x.key === (r.station_id ?? 'none'));
      if (!g) { g = { key: 'none', station: null, title: 'Not On A Team Yet', rows: [] }; out.push(g); }
      g.rows.push(r);
    }
    // A station made only for prizes (a raffle) stays off this page until it has devices.
    return out.filter((t) => (t.station ? !t.station.prize_only || t.rows.length > 0 : t.rows.length > 0));
  }, [detail?.stations, rows, grouped, group, rankOf, problems, steps, doneSet, day]);

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
    setText('');
    focusRow(res.item.id, res.station?.id ?? 'none');
    input.current?.focus();
  }
  const kitMissing = (r: Pick<Target, 'id'>, item: string, was: boolean) => kitFlags[r.id]?.[item] ?? was;
  const kitBody = (r: Target) => r.kit.map((k) => ({ item: k.item, missing: kitMissing(r, k.item, k.missing) }));
  const kitStep = steps.find((x) => x.kit) ?? null;
  async function onKitPart(r: Row, item: string) {
    const was = r.kit.find((k) => k.item === item)?.missing ?? false;
    const to = !kitMissing(r, item, was);
    setKitFlags((cur) => ({ ...cur, [r.id]: { ...cur[r.id], [item]: to } }));
    if (kitStep && realDone.has(`${r.id}:${kitStep.id}`)) {   // Check done is already ticked: the change is saved now
      const res = await plan.doStep({ ...bodyOf(r), step_id: kitStep.id, kit: r.kit.map((k) => ({ item: k.item, missing: k.item === item ? to : kitMissing(r, k.item, k.missing) })) });
      if (!res.ok) { setKitFlags((cur) => ({ ...cur, [r.id]: { ...cur[r.id], [item]: !to } })); setFeedback({ tone: 'error', text: res.error }); }
    }
  }
  function begin(row: Row | null, forStep: StepDef | null = step, tag?: string) {
    if (!forStep) return;
    let target: Target | null = row;
    if (!row && tag) {
      const b = detail?.borrowed.find((x) => tagKey(x.tag) === tagKey(tag));
      const d = data.devices.find((x) => tagKey(x.tag) === tagKey(tag));
      if (b) target = { id: b.id, kind: b.owner_kind, itemKind: b.owner_kind, tag: b.tag, type: b.type, kit: b.kit };
      else if (d) target = { id: d.id, kind: 'club', itemKind: 'club', tag: d.tag, type: d.type, kit: d.kit };
    }
    // Check done is one tap: the parts shown on the row go with it, those flagged missing on the sheet marked missing, the rest present.
    void run({ ...(row ? bodyOf(row) : { tag }), ...(forStep.kit && target && target.kit.length > 0 ? { kit: kitBody(target) } : {}) }, forStep);
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
  // The portal's Scan button (one camera for everything) offers its scans to this page first while the event day is open: a device's QR (its ID, or a link ending in it) marks the selected step,
  // the same as typing the ID. Anything that is a TGcode or a portal link is left for the Scan button.
  const scanRef = useRef<(text: string, say: (m: string, ok: boolean) => void) => boolean>(() => false);
  scanRef.current = (raw, say) => {
    if (!(page === 'device' && day && !closed && step)) return false;
    let tag = raw.trim();
    try { const u = new URL(tag); tag = u.searchParams.get('tag') ?? u.searchParams.get('id') ?? u.pathname.split('/').filter(Boolean).pop() ?? tag; } catch { /* plain text */ }
    try { tag = decodeURIComponent(tag); } catch { /* keep as is */ }
    tag = tag.trim();
    if (!tag) return false;
    if (step.kit) { say(`“${step.name}” reviews the parts: tick it on the sheet or type the ID.`, false); return true; }
    void plan.doStep({ tag, step_id: step.id }).then((r) => {
      if (!r.ok) { say(r.error, false); return; }
      const nm = r.result.item.tag ?? r.result.item.type;
      say(r.result.already ? `${nm} was already marked “${step.name}”.` : `${nm}: ${step.name}`, !r.result.already);
      if (!r.result.already) offerUndo(`${nm}: ${step.name}`, () => void undo({ id: r.result.item.id, kind: r.result.item.kind }, step.id));
    });
    return true;
  };
  useEffect(() => registerScanHandler((text, say) => scanRef.current(text, say)), []);
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
    const res = await plan.doSteps(forStep.id, todo.map(bodyOf));   // one request for the whole team
    setPend(keys, null);
    setFeedback(res.ok ? { tone: 'ok', text: `${todo.length} marked “${forStep.name}”` } : { tone: 'error', text: `None of the ${todo.length} could be marked “${forStep.name}”. ${res.error}` });
  }

  if (!detail) return <div className={styles.tab}><button type="button" className={styles.back} onClick={onBack} aria-label="All events"><ArrowLeft size={15} aria-hidden="true" /> All Plans</button>{error ? <Notice tone="error">{error}</Notice> : <Loading variant="inline" label="Loading…" />}</div>;

  const { plan: p, canManage, stations, borrowed, extras } = detail;
  const closed = p.status === 'closed';
  const manage = canManage && !closed && !day;   // the event day only keeps track (ticks and swaps); rows, teams and prizes are changed in Allocation
  const fb = feedback, res = fb?.result;
  const resStation = res?.station ? stationOf.get(res.station.id) : null;
  const pct = allTotal ? Math.round((allDone / allTotal) * 100) : 0;
  const lockedSet = new Set(detail.lockedRequests ?? []);   // requests whose allocation is locked: their empty rows are not filled
  const isLockedRow = (r: Row) => !!r.requestId && lockedSet.has(r.requestId);
  const emptyRows = rows.filter((r) => r.kind === 'slot' && !r.counted && !isLockedRow(r));
  // The IDs that can still be typed into a row: usable devices of that type that are not in this plan yet (the browser suggests them as you type).
  const ids = (type: string) => [...(free.get(type) ?? [])].sort(natural).map((value) => ({ value }));
  const inPlan = new Set(detail.items.map((i) => i.device_id));
  const free = new Map<string, string[]>();
  for (const dv of data.devices) if (dv.tag && !inPlan.has(dv.id) && isUsable(dv)) free.set(dv.type, [...(free.get(dv.type) ?? []), dv.tag]);
  for (const b of borrowed) if (b.role === 'planned' && !b.request_id && !b.station_id) free.set(b.type, [...(free.get(b.type) ?? []), b.tag]);
  const ctx: SheetCtx = {
    lockedIds: new Set(detail.lockedRequests ?? []), hideDone: day && openOnly, ids, setsOpen: setsOpenPick ?? !day, foldGen, byType: grouped,
    api: plan, canManage: canManage && !day, manager: canManage, closed, busy, pending: pendingSet, main: mainTypes, day, stations, steps, activeId: step?.id ?? '', doneSet, realDone, kitFlags, onKitPart, doneAt, doneBy, problems,
    onTick: (row, s) => void tick(row, s), onTickAll: (list, s) => void markAll(list, s), onUndo: undo, onSwap: (r) => setSwapping({ id: r.id, tag: r.tag, type: r.type, kind: r.kind === 'slot' ? 'club' : r.kind }),
    onBorrowed: (r) => setBorrowing(borrowed.find((b) => b.id === r.id) ?? null), onInstalled: (list) => void install(list), onEditDevice: (r) => setDeviceEdit(catalog.data?.devices.find((x) => x.id === r.id) ?? data.devices.find((x) => x.id === r.id) ?? null),
  };
  // One section at a time (the Devices page's switch): opening a team folds the others, and at first only the first team is open.
  const foldOf = (key: string, complete: boolean) => (key in fold ? fold[key] : accordion ? key !== teams[0]?.key : complete || narrow);
  // On a phone only one team is open at a time on the event day: opening one folds the rest.
  const toggleFold = (key: string, complete: boolean) => setFold((cur) => {
    const opening = foldOf(key, complete);
    const others = (accordion || (narrow && day)) && opening ? Object.fromEntries(teams.filter((x) => x.key !== key).map((x) => [x.key, true])) : {};
    return { ...cur, ...others, [key]: !opening };
  });
  const allFolded = teams.length > 0 && teams.every((t) => { const tot = steps.reduce((n, st) => n + t.rows.filter((r) => stepAppliesTo(st, rowKind(r))).length, 0); const dn = steps.reduce((n, st) => n + t.rows.filter((r) => stepAppliesTo(st, rowKind(r)) && doneSet.has(`${r.id}:${st.id}`)).length, 0); return foldOf(t.key, tot > 0 && dn === tot); });
  const jump = (sid: string | null) => { if (!sid) return; setFold((cur) => ({ ...cur, ...(accordion || (narrow && day) ? Object.fromEntries(teams.filter((x) => x.key !== sid).map((x) => [x.key, true])) : {}), [sid]: false })); setTimeout(() => document.getElementById(`st-${sid}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0); };

  // The games a row needs that its device doesn't list yet are added to the device's installed games (the same list as in Equipment, with its history line).
  async function install(list: Row[]) {
    setBusy(true); setError('');
    for (const r of list) {
      if (r.kind === 'slot') continue;
      const miss = r.games_needed.filter((g) => !r.games.some((x) => x.toLowerCase() === g.toLowerCase()));
      if (!miss.length) continue;
      if (r.kind === 'club') await catalog.saveDevice(r.id, { games: [...r.games, ...miss] });
      else await plan.act(`/loaners/${r.id}`, 'PATCH', { games: [...r.games, ...miss] });
    }
    await plan.reload();
    setBusy(false);
  }


  if (data.requestOnly) {
    // A division account: just the Requests pages of the event, devices or prizing.
    return (
      <div className={styles.dayPage}>
        <div className={styles.dayBar}>
          <button type="button" className={styles.back} onClick={onBack} aria-label="All events"><ArrowLeft size={15} aria-hidden="true" /> <span className={styles.backText}>All Events</span></button>
          <div className={styles.dayHeading}><b className={styles.dayTitle}>{p.name}</b><span className={styles.muted}>{range(p.starts_on, p.ends_on)}</span></div>
        </div>
        <SectionTabs<'devices' | 'prizing'> variant="segmented" label="Devices or prizing" value={page === 'requests-prizing' ? 'prizing' : 'devices'} onChange={(g) => onPage(g === 'prizing' ? 'requests-prizing' : 'requests')} tabs={[{ id: 'devices', label: 'Devices', count: requests.count('devices') }, { id: 'prizing', label: 'Prizing', count: requests.count('prizes') }]} />
        <RequestsTab store={requests} key={page === 'requests-prizing' ? 'p' : 'd'} kind={page === 'requests-prizing' ? 'prizes' : 'devices'} plan={plan} api={catalog} data={data} />
      </div>
    );
  }
  return (
    <div className={`${styles.dayPage} ${page === 'device' && day && !closed ? styles.dayPageBar : ''} ${day ? styles.dayMode : ''}`}>
      <div className={styles.dayTop}>
        {!embedded && (
        <div className={styles.dayBar}>
          <button type="button" className={styles.back} onClick={onBack}><ArrowLeft size={15} aria-hidden="true" /> <span className={styles.backText}>All Events</span></button>
          <div className={styles.dayHeading}>
            <b className={styles.dayTitle}>{p.name}{closed && <span className={`${styles.badge} ${styles.neutral}`}>Closed</span>}</b>
            <span className={styles.muted}>{range(p.starts_on, p.ends_on)}{p.event_id ? ' · portal event' : ' · Event logistics only'}{p.notes ? ` · ${p.notes}` : ''}</span>
          </div>
          <button type="button" className={`${styles.narrow} ${styles.groupSwitch}`} onClick={() => onPage(isPrizing ? 'requests' : 'requests-prizing')} aria-label={isPrizing ? 'Switch to devices' : 'Switch to prizing'}><ArrowLeftRight size={14} aria-hidden="true" /> {isPrizing ? 'Devices' : 'Prizing'}</button>
          {page === 'device' && day && <span className={styles.dayTotal} title="Steps done"><span className={styles.bar}><i style={{ width: `${pct}%` }} /></span>{allDone}/{allTotal}</span>}
        </div>
        )}
        <div className={styles.pageBar}>
        {!embedded && <>
        <span className={`${styles.wide} ${styles.groupSeg}`}><SectionTabs<'devices' | 'prizing'> variant="segmented" label="Devices or prizing" value={isPrizing ? 'prizing' : 'devices'}
          onChange={(g) => onPage(g === 'prizing' ? 'requests-prizing' : 'requests')} tabs={[{ id: 'devices', label: 'Devices', count: rows.length }, { id: 'prizing', label: 'Prizing', count: detail.prizes.lines.length }]} /></span>
        <SectionTabs<string> variant="segmented" label="Event pages" value={page === 'requests' || page === 'requests-prizing' ? page : `${day && page === 'device' ? 'day' : 'alloc'}-${page}`}
          onChange={(v) => v === 'requests' || v === 'requests-prizing' ? onPage(v) : onPage(v.replace(/^(day|alloc)-/, '') as EventPage, v.startsWith('day-'))} tabs={isPrizing ? [
            { id: 'requests-prizing', label: 'Requests', count: requests.count('prizes') },
          ] : [
            { id: 'requests', label: 'Requests', count: requests.count('devices') },
            { id: 'alloc-sponsor-loaners', label: 'Sponsor Loaners', count: borrowed.filter((b) => b.owner_kind === 'sponsor').length },
            { id: 'alloc-officer-loaners', label: 'Officer Loaners', count: borrowed.filter((b) => b.owner_kind === 'officer').length },
            { id: 'alloc-device', label: 'Allocation', count: rows.length },
            { id: 'day-device', label: 'Event Day' },
          ]} />
        </>}
          <span className={styles.pageBarEnd}>
            {embedded && page === 'device' && day && <span className={styles.dayTotal} title="Steps done"><span className={styles.bar}><i style={{ width: `${pct}%` }} /></span>{allDone}/{allTotal}</span>}
            {isPrizing && <Button size="sm" variant="secondary" onClick={onOpenPrizing}>Open Prizing</Button>}
            {!isPrizing && !embedded && onOpenDevices && <Button size="sm" variant="secondary" onClick={onOpenDevices}>Open Devices</Button>}
            <DeviceFinder prizes={prizeInv.rows} planPrizes={detail.prizes} sponsorOf={(sid) => data.sponsors.find((s) => s.id === sid)?.name ?? null} onGoPrize={onOpenPrizing} rows={all} devices={data.devices} stations={stations} steps={steps} doneSet={doneSet} onGo={(r) => { if (page !== 'device') onPage('device', day); setTimeout(() => focusRow(r.id, grouped ? `${group}:${groupTitles(r, group as Exclude<DeviceGroup, 'station'>, { attention: () => false, complete: () => false, day })[0]}` : r.stationId ?? 'none'), page !== 'device' ? 400 : 0); }} />
            <button type="button" className={styles.iconBtn} onClick={() => void plan.reload()} aria-label="Refresh"><RefreshCw size={15} aria-hidden="true" /></button>
          </span>
        </div>
        {page === 'device' && day && !closed && (
          <div className={`${styles.dayStick} ${kb > 80 ? styles.kbOpen : ''}`} style={{ '--kb': `${kb}px` } as React.CSSProperties}>
            <form className={styles.dayForm} onSubmit={(e) => { e.preventDefault(); submit(); }}>
            <div className={styles.dayStepPick}>
              <Combo value={picked ? stepLabel(stepStats.find((x) => x.step.id === picked)) : `Next: ${auto?.name ?? '–'}`} options={[`Next: ${auto?.name ?? '–'}`, ...stepStats.map((x) => stepLabel(x) ?? '')]} clearable={false} ariaLabel="Step to mark when typing an ID"
                onChange={(v) => { setPicked(stepStats.find((x) => stepLabel(x) === v)?.step.id ?? ''); }} />
            </div>
            <Suggest inputRef={input} className={styles.dayInput} value={text} onChange={setText} options={dayIds} placeholder="Type an ID" aria-label={`Device ID for ${step?.name ?? 'the step'}`} autoCapitalize="characters" autoComplete="off" autoCorrect="off" spellCheck={false} enterKeyHint="done" disabled={busy || !step} />
            <Button type="submit" disabled={!text.trim() || busy} loading={busy}>Mark</Button>
            <button type="button" className={`${styles.iconBtn} ${styles.scanDesk}`} title="Scan a device" aria-label="Open the scanner" onClick={() => setScanning(true)} disabled={!step}><Camera size={16} aria-hidden="true" /></button>
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
      {scanning && <UniversalScanner onClose={() => setScanning(false)} />}
      {error && <div role="alert" onClick={() => setError('')}><Notice tone="error">{error}</Notice></div>}
      {deviceEdit && <DeviceDialog api={catalog} data={data} device={deviceEdit} onClose={() => { setDeviceEdit(null); void plan.reload(); }} />}
      {swapping && <SwapDialog plan={plan} options={[...(free.get(swapping.type) ?? [])].sort(natural)} device={swapping} onClose={() => setSwapping(null)} />}
      {borrowing && <BorrowedDialog plan={plan} catalog={catalog} data={data} borrowed={borrowing === 'new' ? null : borrowing} onClose={() => setBorrowing(null)} />}
      {stationDialog && !stationDialog.station && <StationDialog plan={plan} station={null} onClose={() => setStationDialog(null)} />}
      {filling && !filling.station && <FillDialog plan={plan} station={null} onClose={() => setFilling(null)} />}

      {page === 'sponsor-loaners' && <BorrowedTab plan={plan} catalog={catalog} data={data} kind="sponsor" />}
      {page === 'officer-loaners' && <BorrowedTab plan={plan} catalog={catalog} data={data} kind="officer" />}
      {(page === 'requests' || page === 'requests-prizing') && <RequestsTab store={requests} key={page} kind={page === 'requests' ? 'devices' : 'prizes'} plan={plan} api={catalog} data={data} />}

      {page === 'device' && <div className={styles.dayLayout}>

        <div className={styles.dayMain}>
          {day && narrow && teams.length > 1 && (
            <nav className={styles.teamChips} aria-label="Jump to a team">
              {teams.map((tm) => {
                const tot = steps.reduce((n, st) => n + tm.rows.filter((r) => stepAppliesTo(st, rowKind(r))).length, 0);
                const dn = steps.reduce((n, st) => n + tm.rows.filter((r) => stepAppliesTo(st, rowKind(r)) && doneSet.has(`${r.id}:${st.id}`)).length, 0);
                const full = tot > 0 && dn === tot;
                return <button key={tm.key} type="button" className={`${styles.teamChip} ${full ? styles.teamChipDone : ''}`} onClick={() => jump(tm.key)}>{tm.title}<small>{full ? '✓' : `${dn}/${tot}`}</small></button>;
              })}
            </nav>
          )}
          {rows.length > 0 && (
            <section className={`${styles.statusBar} ${bad ? styles.readyBad : warn ? styles.readyWarn : styles.readyOk}`} aria-label="What needs fixing">
              <div className={`${styles.readyHead} ${problems.length > 0 ? styles.clickRow : ''}`} onClick={(e) => { if (problems.length > 0 && !interactive(e.target)) setShowList((v) => !v); }} role={problems.length > 0 ? 'button' : undefined} tabIndex={problems.length > 0 ? 0 : undefined} aria-expanded={problems.length > 0 ? showList : undefined} onKeyDown={(e) => { if (problems.length > 0 && (e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); setShowList((v) => !v); } }}>
                <b>{bad || warn ? <>{problems.length} to fix</> : <><span className={styles.narrow}>Ready</span><span className={styles.wide}>Everything is ready</span></>}</b>
                {bad > 0 && <span className={`${styles.badge} ${styles.bad}`} title={`${bad} wrong`}>{bad}<span className={styles.wide}>wrong</span></span>}
                {warn > 0 && <span className={`${styles.badge} ${styles.warnBadge}`} title={`${warn} to check`}>{warn}<span className={styles.wide}>to check</span></span>}
                {problems.length > 0 && <span className={`${styles.dim} ${styles.wide}`}>{showList ? 'Click to hide the list' : 'Click to see the list'}</span>}
                <span className={styles.statusSpacer} />
                <span className={styles.narrow}><RowMenu label="View options" items={[
                  day && page === 'device' && { label: openOnly ? 'Show All' : 'Unfinished Only', onClick: () => onOpenOnly(!openOnly) },
                  manage && emptyRows.length > 0 && { label: `Fill ${emptyRows.length} Empty`, onClick: () => setFilling({ station: null }) },
                  day && { label: overview ? 'Hide Overview' : 'Overview', onClick: () => setOverview((v) => !v) },
                  { label: allFolded ? 'Expand All' : 'Collapse All', onClick: () => { setFold(Object.fromEntries(teams.map((t) => [t.key, !allFolded]))); setSetsOpenPick(allFolded); setFoldGen((g) => g + 1); } },
                ]} /></span>
                {day && page === 'device' && <button type="button" className={`${styles.linkBtn} ${styles.wide}`} aria-pressed={openOnly} onClick={() => onOpenOnly(!openOnly)}>{openOnly ? 'Show All' : 'Unfinished Only'}</button>}
                {manage && emptyRows.length > 0 && <button type="button" className={`${styles.linkBtn} ${styles.wide}`} onClick={() => setFilling({ station: null })}>Fill {emptyRows.length} Empty</button>}
                {day && <button type="button" className={`${styles.linkBtn} ${styles.wide}`} aria-expanded={overview} onClick={() => setOverview((v) => !v)}>{overview ? 'Hide overview' : 'Overview'}</button>}
                <button type="button" className={`${styles.linkBtn} ${styles.wide}`} onClick={() => { setFold(Object.fromEntries(teams.map((t) => [t.key, !allFolded]))); setSetsOpenPick(allFolded); setFoldGen((g) => g + 1); }}>{allFolded ? 'Expand all' : 'Collapse all'}</button>
              </div>
              {showList && problems.length > 0 && (
                <ul className={styles.problemList}>
                  {problems.map((pr, i) => (
                    <li key={i} className={pr.sev === 'bad' ? styles.problemBad : styles.problemWarn}>
                      <span>{pr.text}</span>
                      {grouped
                        ? (() => { const r = rows.find((x) => x.id === pr.row_id); const t = r ? teams.find((g) => g.rows.some((x) => x.id === r.id)) : null; return t ? <button type="button" className={styles.linkBtn} onClick={() => jump(t.key)}>Go to group</button> : null; })()
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
            const emptyHere = t.rows.filter((r) => r.kind === 'slot' && !r.counted && !isLockedRow(r)).length;
            return (
              <section key={t.key} id={`st-${t.key}`} className={`${styles.dayTeam} ${day ? '' : styles.noSteps} ${day && complete ? styles.dayTeamDone : ''}`} style={{ '--n': steps.length } as React.CSSProperties} aria-label={t.title}>
                <div className={`${styles.dayRow} ${styles.dayRowHead} ${styles.clickRow}`} onClick={(e) => { if (!interactive(e.target)) toggleFold(t.key, complete); }}>
                  <div className={styles.teamHeadMain}>
                    <div className={styles.teamLine}>
                      <button type="button" className={styles.foldBtn} aria-expanded={!folded} onClick={() => toggleFold(t.key, complete)}>
                        <span className={styles.foldMark} aria-hidden="true">{folded ? <Plus size={13} strokeWidth={2.4} /> : <Minus size={13} strokeWidth={2.4} />}</span>
                        <b>{t.title}</b>
                      </button>
                      {s && <span className={`${styles.statusChip} ${status === 'ok' ? styles.chipOk : status === 'bad' ? styles.chipBad : styles.chipWarn}`}>{status === 'ok' ? <><span className={styles.narrow} aria-label="Ready">✓</span><span className={styles.wide}>Ready</span></> : <>{mine.length}<span className={styles.wide}>to fix</span></>}</span>}
                      {day && <span className={complete ? styles.dTeamDone : styles.dTeamNum}>{complete ? 'All done' : `${done}/${total}`}</span>}
                    </div>
                    {s && (
                      <div className={styles.teamLine}>
                        <span className={styles.dTeamSub}>{s.contact ?? <span className={styles.warnText}>No contact</span>}</span>
                        <span className={styles.dTeamSub}><TextCell value={s.room} canEdit={manage} placeholder="Add room" onSave={(v) => void plan.act(`/stations/${s.id}`, 'PATCH', { room: v })} /></span>
                        {manage && emptyHere > 0 && <button type="button" className={styles.miniTextBtn} onClick={() => setFilling({ station: s })}>Fill {emptyHere}<span className={styles.wide}>Empty</span></button>}
                      </div>
                    )}
                  </div>
                  {day && <div className={styles.dHeads}>
                    {mineStats.map((x) => (
                      <button key={x.s.id} type="button" className={`${styles.dHead} ${step?.id === x.s.id ? styles.dHeadOn : ''} ${x.total > 0 && x.done === x.total ? styles.dHeadDone : ''}`} onClick={() => { setPicked(x.s.id); }} title={`Type IDs for “${x.s.name}”`}>
                        <span>{x.s.name}</span><small>{x.done}/{x.total}</small>
                      </button>
                    ))}
                  </div>}
                </div>
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

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Search, Settings2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import Loading from '@/components/Loading/Loading';
import Notice from '@/components/ui/Notice';
import { Input, Select } from '@/components/ui/Field';
import SectionTabs from '@/components/ui/SectionTabs';
import { confirmHold } from '@/lib/ui/confirmHold';
import { RowMenu } from './RowMenu';
import { ANY_SIZE, isLoose, lineNumbers, setLooseSizes, suggestPrizes, stepCeiling, type PrizeStepDef, type StockLevel } from '@/lib/logistics/prizes';
import {
  GROUPS,
  impliedCount,
  eventSlugOf,
  fromOf,
  STATUS_LABEL,
  STOCK_STATUS_LABEL,
  STATUS_ORDER,
  eventHolds,
  groupBy,
  isGroupBy,
  money,
  prizingFixes,
  stationNeed,
  statusOf,
  valueOf,
  type Fix,
  type GroupBy,
} from '@/lib/logistics/prizing';
import { AddStationDialog, PastEventsDialog, PrizeEditor, PrizingSettings, type PrizeTab } from './PrizingDialogs';
import { FixStrip, GroupBlock, StationBlock, StockBlock, type GroupLine, type PrizingCtx, type Row } from './PrizingParts';
import { StationDialog } from './PlanDialogs';
import { usePlan, usePlanList, type PlanSummary, type Station } from './usePlans';
import { useLiveTeam } from './useLiveTeam';
import LivePill from './LivePill';
import { useCloseEvent } from './CloseEvent';
import PrizingSheet from './PrizingSheet';
import ViewSwitch from './ViewSwitch';
import { autoPlan, eventLabel } from './eventPick';
import type { LiveEnvelope } from '@/lib/logistics/live';
import { usePrizes, type PrizeRow } from './usePrizes';
import type { Catalog, LogisticsApi } from './useLogistics';
import type { Route } from './logisticsRoute';
import styles from './logistics.module.css';
import pz from './prizing.module.css';

const VIEW_KEY = 'tg-prizing-view';
interface View {
  group: GroupBy;
  steps: string[];
  oneAtATime: boolean;
  hideGone: boolean;
} // group: stations (an event only) or one of the others; the stock without an event is never grouped by station
const DEFAULT_VIEW: View = { group: 'station', steps: ['sorted'], oneAtATime: true, hideGone: true };
const EVENT_KEY = 'tg-prizing-event'; // the last event looked at, for coming back from the stock
const readView = (): View => {
  try {
    const j = JSON.parse(localStorage.getItem(VIEW_KEY) ?? 'null');
    if (j)
      return {
        group: isGroupBy(j.group) ? j.group : DEFAULT_VIEW.group,
        steps: Array.isArray(j.steps) ? j.steps.map(String) : DEFAULT_VIEW.steps,
        oneAtATime: j.oneAtATime !== false,
        hideGone: j.hideGone !== false,
      };
  } catch {
    /* nothing remembered */
  }
  return DEFAULT_VIEW;
};

// Prizing: every prize and the event it is going to on one page. The table is the stock (change the number on hand right in it) and, with an event picked, what each station of that event gets (change those
// numbers too: moving 5 from one station to another is lowering one number and raising the other). The "Fix these" strip says what is wrong, "Group by" shows it by station, sponsor, size, type or status, and the
// event-day counters (Sorted by default) are under each station. Each prize has a history of what happened to its stock.
export default function PrizingPage({ api, data, slug, sheet, go }: { api: LogisticsApi; data: Catalog; slug: string | null; sheet?: boolean; go: (r: Route) => void }) {
  const list = usePlanList();
  useMemo(() => setLooseSizes(data.lists.prize_size.filter((o) => o.loose).map((o) => o.value)), [data.lists.prize_size]); // which sizes are counted loosely, before anything asks
  const prizes = usePrizes();
  const chosen: PlanSummary | null | undefined = useMemo(() => {
    if (!list.plans) return undefined;
    if (slug === 'stock') return null;
    return list.plans.find((p) => p.slug === slug) ?? autoPlan(list.plans, list.today);
  }, [list.plans, list.today, slug]);
  const plan = usePlan(chosen?.id ?? '', true);
  useEffect(() => {
    if (chosen)
      try {
        localStorage.setItem(EVENT_KEY, chosen.slug);
      } catch {
        /* not remembered */
      }
  }, [chosen]);
  // Back from the stock: the last event looked at if it still exists, else today's or the next one (the address with no event).
  const lastEvent = () => {
    let k: string | null = null;
    try {
      k = localStorage.getItem(EVENT_KEY);
    } catch {
      /* none */
    }
    return k && list.plans?.some((p) => p.slug === k) ? k : null;
  };
  const d = plan.detail;
  const [view, setView] = useState<View>(DEFAULT_VIEW);
  useEffect(() => {
    setView(readView());
  }, []);
  const change = (patch: Partial<View>) =>
    setView((v) => {
      const next = { ...v, ...patch };
      try {
        localStorage.setItem(VIEW_KEY, JSON.stringify(next));
      } catch {
        /* not remembered */
      }
      return next;
    });
  const [q, setQ] = useState('');
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({}); // the stock's groups (a sponsor, a size…) start folded; a search opens them all
  const toggleGroup = (key: string) => {
    const id = `${group}:${key}`,
      now = groupOpen(key),
      base = openAll || q.trim() ? {} : openGroups;
    setOpenAll(false);
    setOpenGroups(view.oneAtATime && !now ? { [id]: true } : { ...base, [id]: !now }); // one at a time: opening one folds the others
  };
  const [openAll, setOpenAll] = useState(false); // set when a "fix this" jumps to a prize, so its group is open
  const groupOpen = (key: string) => !!q.trim() || openAll || !!openGroups[`${group}:${key}`];
  const [flash, setFlash] = useState('');
  const [dialog, setDialog] = useState<
    null | { kind: 'prize'; prize: PrizeRow | null; tab?: PrizeTab } | { kind: 'settings' } | { kind: 'station'; station: Station | null } | { kind: 'addStation' }
  >(null);
  const [filling, setFilling] = useState('');
  const [guesses, setGuesses] = useState<Parameters<typeof PastEventsDialog>[0]['guesses']>([]);
  const [pastOpen, setPastOpen] = useState(false);
  const loadGuesses = useCallback(() => {
    if (!data.canManage) return;
    void fetch('/api/logistics/prizes/past-events', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => setGuesses(Array.isArray(j.suggestions) ? j.suggestions : []))
      .catch(() => setGuesses([]));
  }, [data.canManage]);
  useEffect(() => {
    loadGuesses();
  }, [loadGuesses]);
  const [shortOf, setShortOf] = useState<Record<string, string>>({});
  const [openStations, setOpenStations] = useState<Record<string, boolean>>({}); // what was opened or folded by hand
  const [flashKeys, setFlashKeys] = useState<Set<string>>(new Set());
  const [feed, setFeed] = useState<{ id: number; by: string; text: string; at: number }[]>([]);

  const hasEvent = !!chosen && !!d;
  const eventClosed = d?.plan.status === 'closed';
  const manage = data.canManage && hasEvent && !eventClosed;
  const group: GroupBy = view.group === 'station' && !hasEvent ? 'sponsor' : view.group;
  const sizeOrder = useMemo(() => data.lists.prize_size.map((o) => o.value), [data.lists.prize_size]);
  const slugByPlan = useMemo(() => new Map((list.plans ?? []).map((p) => [p.id, p.slug])), [list.plans]);
  const sponsorName = useMemo(() => new Map(data.sponsors.map((s) => [s.id, s.name])), [data.sponsors]);
  const steps: PrizeStepDef[] = d?.prizes.steps ?? [];
  const [wide, setWide] = useState(true); // a laptop: every counter is shown; on a phone or tablet the chips pick which
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1280px)');
    const read = () => setWide(mq.matches);
    read();
    mq.addEventListener('change', read);
    return () => mq.removeEventListener('change', read);
  }, []);
  const shownSteps = useMemo(() => {
    if (wide) return steps;
    const names = new Set(view.steps.map((s) => s.toLowerCase()));
    const shown = steps.filter((s) => names.has(s.name.toLowerCase()));
    return shown.length ? shown : steps.filter((s) => s.name.toLowerCase() === 'sorted').slice(0, 1);
  }, [steps, view.steps, wide]);
  const stations = useMemo(() => d?.stations ?? [], [d?.stations]);
  const lines = useMemo(() => d?.prizes.lines ?? [], [d?.prizes.lines]);
  const countMap = useMemo(() => new Map((d?.prizes.done ?? []).map((x) => [`${x.line_id}:${x.step_id}`, x.done])), [d?.prizes.done]);
  const giveIds = useMemo(() => steps.filter((s) => s.gives).map((s) => s.id), [steps]);
  const count = useCallback((lineId: string, stepId: string) => countMap.get(`${lineId}:${stepId}`) ?? 0, [countMap]);
  const shown = useCallback(
    (lineId: string, stepId: string, ceiling: number) =>
      Math.min(
        ceiling,
        impliedCount(steps, (sid) => countMap.get(`${lineId}:${sid}`) ?? 0, stepId),
      ),
    [steps, countMap],
  );
  const givenOf = useCallback((lineId: string) => giveIds.reduce((n, id) => n + (countMap.get(`${lineId}:${id}`) ?? 0), 0), [giveIds, countMap]);
  const backIds = useMemo(() => steps.filter((s) => s.leftover).map((s) => s.id), [steps]);
  const backOf = useCallback((lineId: string) => backIds.reduce((n, id) => n + (countMap.get(`${lineId}:${id}`) ?? 0), 0), [backIds, countMap]);
  const lockedIds = useMemo(() => new Set(d?.lockedRequests ?? []), [d?.lockedRequests]);
  const isLocked = useCallback((s: Station) => !!s.prize_request_id && lockedIds.has(s.prize_request_id), [lockedIds]);

  // ---- rows ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  const prizeById = useMemo(() => new Map((prizes.rows ?? []).map((p) => [p.id, p])), [prizes.rows]);
  const holds = useMemo(
    () =>
      eventHolds(lines, (l) => {
        const n = lineNumbers(l.quantity, givenOf(l.id), backOf(l.id));
        return n.given + n.back;
      }),
    [lines, givenOf, backOf],
  ); // what is given out or back in storage is no longer held
  const rows: Row[] = useMemo(
    () =>
      (prizes.rows ?? []).map((p) => {
        const h = holds.get(p.id);
        return {
          p,
          sponsor: p.sponsor_id ? (sponsorName.get(p.sponsor_id) ?? null) : null,
          here: h?.total ?? 0,
          remaining: h?.remaining ?? 0,
          elsewhere: Math.max(0, p.allocated - (eventClosed ? 0 : (h?.remaining ?? 0))),
          lines: (h?.lines ?? []).map((l) => ({ id: l.id, station_id: l.station_id, quantity: l.quantity })),
        };
      }),
    [prizes.rows, holds, sponsorName, eventClosed],
  );
  const matches = useCallback(
    (p: PrizeRow, sponsor: string | null) => {
      const t = q.trim().toLowerCase();
      return !t || `${p.name} ${sponsor ?? ''} ${p.type ?? ''} ${p.size ?? ''} ${p.bin ?? ''} ${p.source ?? ''}`.toLowerCase().includes(t);
    },
    [q],
  );

  // ---- stations -----------------------------------------------------------------------------------------------------------------------------------------------------------------------
  const stationData = useMemo(
    () =>
      stations.map((s) => {
        const ls = lines
          .filter((l) => l.station_id === s.id)
          .map((l) => ({
            id: l.id,
            quantity: l.quantity,
            p:
              prizeById.get(l.prize_id) ??
              ({ ...l.prize, bin: null, source: null, expires_on: null, notes: null, quantity_is_estimate: false, sponsor_id: null, allocated: 0 } as unknown as PrizeRow),
            sponsor: l.prize.sponsor,
          }));
        const n = stationNeed(
          s,
          ls.map((l) => ({ quantity: l.quantity, size: l.p.size })),
        );
        return { s, ls, n };
      }),
    [stations, lines, prizeById],
  );
  const shownStations = stationData.filter((x) => !x.s.prize_only || true).filter((x) => x.ls.length > 0 || !!x.s.prize_request_id || x.s.prize_only);
  const addableStations = stations.filter((s) => !shownStations.some((x) => x.s.id === s.id));
  const fixes: Fix[] = useMemo(
    () =>
      !hasEvent || eventClosed
        ? []
        : prizingFixes({
            prizes: rows.map((r) => ({ ...r.p, assignedHere: r.here })),
            sizeOrder,
            stations: shownStations.map((x) => ({ ...x.s, lines: x.ls.length, short: x.n.need })),
          }),
    [hasEvent, eventClosed, rows, shownStations, sizeOrder],
  );
  // Every station starts folded. One at a time (a remembered switch, on until turned off): opening a station folds the others.
  const stationOpen = (id: string) => (id in openStations ? openStations[id] : false); // every station starts folded
  const toggleStation = (id: string) =>
    setOpenStations((cur) => {
      const now = id in cur ? cur[id] : false;
      if (view.oneAtATime && !now) return { ...Object.fromEntries(stations.map((x) => [x.id, false])), [id]: true };
      return { ...cur, [id]: !now };
    });
  const setAllStations = (open: boolean) => setOpenStations(Object.fromEntries(stations.map((x) => [x.id, open])));
  const needy = shownStations.filter((x) => Object.keys(x.n.need).length > 0 && !isLocked(x.s));

  // ---- changes ------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  const summaryOf = (p: PrizeRow) => ({
    id: p.id,
    name: p.name,
    sponsor: p.sponsor_id ? (sponsorName.get(p.sponsor_id) ?? null) : null,
    size: p.size,
    type: p.type,
    price: p.price,
    quantity: p.quantity,
    quantity_is_estimate: p.quantity_is_estimate,
    in_hand: p.in_hand,
    left: p.left,
  });
  const setLine = useCallback(
    async (stationId: string, p: PrizeRow, n: number) => {
      const r = await plan.setPrizeLine(stationId, summaryOf(p), Math.max(0, Math.round(n)));
      if (r.ok && r.delta) prizes.bump(p.id, r.delta);
    },
    [plan, prizes, sponsorName],
  ); // eslint-disable-line react-hooks/exhaustive-deps
  const setCount = useCallback(
    (lineId: string, stepId: string, n: number) => {
      void plan.setPrizeCount(lineId, stepId, n);
    },
    [plan],
  );
  const addCount = useCallback(
    (lineId: string, stepId: string, d: number) => {
      void plan.addPrizeCount(lineId, stepId, d);
    },
    [plan],
  );
  const setLevel = useCallback(
    (p: PrizeRow, level: StockLevel) => {
      void prizes.save(p.id, { stock_level: level });
    },
    [prizes],
  );
  const setStock = useCallback(
    (p: PrizeRow, n: number) => {
      void prizes.save(p.id, { quantity: n, expected_quantity: p.quantity });
    },
    [prizes],
  );
  async function fillOne(sid: string, used: Map<string, number> = new Map()) {
    const x = stationData.find((y) => y.s.id === sid);
    if (!x) return;
    setFilling(sid);
    const { picks, short } = suggestPrizes(
      (prizes.rows ?? []).filter((p) => p.in_hand).map((p) => ({ id: p.id, size: p.size, left: p.left - (used.get(p.id) ?? 0), sponsor: !!p.sponsor_id })),
      x.n.need,
    );
    for (const [id, n] of picks) used.set(id, (used.get(id) ?? 0) + n);
    for (const [id, n] of picks) {
      const p = prizeById.get(id);
      if (p) await setLine(sid, p, (x.ls.find((l) => l.p.id === id)?.quantity ?? 0) + n);
    }
    setShortOf((c) => ({
      ...c,
      [sid]: Object.keys(short).length
        ? `Not enough in stock for ${Object.entries(short)
            .map(([z, n]) => `${n} ${z === ANY_SIZE ? 'of any size' : z}`)
            .join(', ')}`
        : '',
    }));
    setFilling('');
  }
  async function fillAll() {
    const used = new Map<string, number>();
    for (const x of needy) await fillOne(x.s.id, used);
  }
  async function markAll(stationId: string, step: PrizeStepDef) {
    const x = stationData.find((y) => y.s.id === stationId);
    if (!x) return;
    for (const l of x.ls) {
      const c = stepCeiling(step, l, givenOf(l.id));
      if (c > 0 && count(l.id, step.id) < c) await plan.setPrizeCount(l.id, step.id, c);
    }
  }
  async function lockStation(s: Station, lock: boolean) {
    if (!s.prize_request_id) return;
    if (!lock && !(await confirmHold({ title: `Unlock ${s.name}?`, message: 'Its prizes can be changed again.', confirmLabel: 'Hold to unlock' }))) return;
    await plan.act(`/requests/${s.prize_request_id}`, 'PATCH', { allocation_locked: lock });
    await plan.reload();
  }
  async function removeStation(s: Station) {
    if (
      !(await confirmHold({
        title: `Remove ${s.name}?`,
        message: 'Its prizes are taken off it and counted back as free. If it also has devices, it stays on the Devices page.',
        confirmLabel: 'Hold to remove',
      }))
    )
      return;
    await plan.act(`/stations/${s.id}`, 'DELETE');
    void prizes.reload();
  }
  const closer = useCloseEvent(list, () => {
    void plan.reload();
    void prizes.reload();
  });
  const focus = useCallback(
    (f: Fix['focus']) => {
      const id = f.kind === 'prize' ? `prize-${f.id}` : `station-${f.id}`;
      if (f.kind === 'prize') {
        const at = group === 'station' ? lines.find((l) => l.prize_id === f.id) : undefined;
        if (group !== 'station') {
          setOpenAll(true);
          setFlash(f.id);
          window.setTimeout(() => {
            document.getElementById(`prize-${f.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 60);
          window.setTimeout(() => setFlash(''), 2600);
          return;
        }
        if (at) {
          setOpenStations((cur) => (view.oneAtATime ? { ...Object.fromEntries(stations.map((x) => [x.id, false])), [at.station_id]: true } : { ...cur, [at.station_id]: true }));
          setFlash(f.id);
          window.setTimeout(() => {
            document.getElementById(`station-${at.station_id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 60);
          window.setTimeout(() => setFlash(''), 2600);
          return;
        }
        setOpenAll(true);
        change({ group: 'status' });
        go({ tab: 'prizing', plan: 'stock' });
      }
      if (f.kind === 'station')
        setOpenStations((cur) => (view.oneAtATime ? { ...Object.fromEntries(stations.map((x) => [x.id, false])), [f.id]: true } : { ...cur, [f.id]: true }));
      setFlash(f.id);
      window.setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 60);
      window.setTimeout(() => setFlash(''), 2600);
    },
    [group, lines],
  ); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- other people's changes, as they happen ------------------------------------------------------------------------------------------------------------------------------------
  const latest = useRef({ prizeById, stations, steps, sponsorName });
  latest.current = { prizeById, stations, steps, sponsorName };
  const reloadTimer = useRef<{ plan?: ReturnType<typeof setTimeout>; prizes?: ReturnType<typeof setTimeout> }>({});
  const flashFor = useCallback((keys: string[]) => {
    setFlashKeys((prev) => new Set([...prev, ...keys]));
    window.setTimeout(
      () =>
        setFlashKeys((prev) => {
          const n = new Set(prev);
          keys.forEach((k) => n.delete(k));
          return n;
        }),
      2800,
    );
  }, []);
  const onLive = useCallback(
    (m: LiveEnvelope) => {
      const L = latest.current,
        by = m.by ?? 'Someone';
      const note = (text: string) => setFeed((f) => [{ id: m.at + Math.random(), by, text, at: m.at }, ...f].slice(0, 20));
      if (m.k === 'line') {
        const p = L.prizeById.get(m.prize);
        const ok = plan.applyLine(
          m,
          p
            ? {
                id: p.id,
                name: p.name,
                sponsor: p.sponsor_id ? (L.sponsorName.get(p.sponsor_id) ?? null) : null,
                size: p.size,
                type: p.type,
                in_hand: p.in_hand,
                price: p.price,
                quantity: p.quantity,
                quantity_is_estimate: p.quantity_is_estimate,
                left: p.left,
              }
            : null,
        );
        if (!ok) void plan.reload();
        prizes.bump(m.prize, m.qty - m.was);
        flashFor([`line:${m.line}`, `prize:${m.prize}`]);
        const st = L.stations.find((x) => x.id === m.station)?.name ?? 'a station';
        note(m.qty === 0 ? `took ${p?.name ?? 'a prize'} off ${st}` : `${st} · ${p?.name ?? 'a prize'}: ${m.was} → ${m.qty}`);
      } else if (m.k === 'count') {
        plan.applyCount(m.line, m.step, m.done);
        flashFor([`line:${m.line}`]);
        note(`${L.steps.find((x) => x.id === m.step)?.name ?? 'Step'} counted: ${m.done}`);
      } else if (m.k === 'stock') {
        prizes.applyStock(m.prize, m.qty);
        flashFor([`prize:${m.prize}`]);
        note(`${L.prizeById.get(m.prize)?.name ?? 'A prize'} on hand: ${m.was} → ${m.qty}`);
      } else if (m.k === 'prizes') {
        clearTimeout(reloadTimer.current.prizes);
        reloadTimer.current.prizes = setTimeout(() => void prizes.reload(), 400);
      } else if (m.k === 'plan') {
        clearTimeout(reloadTimer.current.plan);
        reloadTimer.current.plan = setTimeout(() => void plan.reload(), 400);
      }
    },
    [plan, prizes, flashFor],
  );
  const team = useLiveTeam({ me: data.me, planId: chosen?.id ?? null, stockChannel: prizes.channel, onChange: onLive });
  // What a person's open number box is, in words: "prize:<id>" is a prize's stock, "line:<id>" a station's number, "count:<line>:<step>" a counter.
  const describeKey = useCallback(
    (key: string) => {
      const [kind, a] = key.split(':');
      if (kind === 'prize') return prizeById.get(a)?.name ?? null;
      const line = lines.find((l) => l.id === a);
      return line ? `${prizeById.get(line.prize_id)?.name ?? line.prize.name} at ${stations.find((x) => x.id === line.station_id)?.name ?? 'a station'}` : null;
    },
    [prizeById, lines, stations],
  );
  const heldBy = useCallback((key: string) => team.here.find((p) => p.editing === key)?.name ?? null, [team.here]);

  const ctx: PrizingCtx = {
    canStock: data.canManage,
    manage,
    closed: !!eventClosed,
    sizeOrder,
    shownSteps,
    count,
    shown,
    givenOf,
    setLine,
    setCount,
    addCount,
    editing: team.setEditing,
    heldBy,
    flashing: (k) => flashKeys.has(k),
    setStock,
    setLevel,
    where: (p) => setDialog({ kind: 'prize', prize: p, tab: 'where' }),
    eventSlug: (p) => eventSlugOf(p, slugByPlan),
    edit: (p) => setDialog({ kind: 'prize', prize: p }),
    history: (p) => setDialog({ kind: 'prize', prize: p, tab: 'history' }),
    locked: isLocked,
  };

  // ---- what is shown ------------------------------------------------------------------------------------------------------------------------------------------------------------------
  // The stock hides what is all given out (none on hand, or a free prize that is out), unless the switch is turned off.
  const gone = (r: Row) => (isLoose(r.p) ? r.p.stock_level === 'out' : r.p.quantity <= 0);
  const goneCount = rows.filter((r) => gone(r) && matches(r.p, r.sponsor)).length;
  const visibleRows = rows.filter((r) => matches(r.p, r.sponsor) && !(!hasEvent && view.hideGone && gone(r)));
  const groups = useMemo(() => {
    if (group === 'sponsor') return groupBy(visibleRows, (r) => r.sponsor, 'Club (no sponsor)');
    if (group === 'source') return groupBy(visibleRows, (r) => fromOf(r.p, r.sponsor, slugByPlan), 'Unknown');
    if (group === 'size') return groupBy(visibleRows, (r) => r.p.size, 'No size', sizeOrder);
    if (group === 'type') return groupBy(visibleRows, (r) => r.p.type, 'No type');
    const labels = hasEvent ? STATUS_LABEL : STOCK_STATUS_LABEL; // with no event there is nothing "assigned to this event"
    return groupBy(
      visibleRows,
      (r) => labels[statusOf(r.p, hasEvent ? r.here : r.p.allocated)],
      'Other',
      STATUS_ORDER.map((s) => labels[s]),
    );
  }, [group, visibleRows, sizeOrder, hasEvent]);
  // An event grouped by something other than its stations: the same lines, grouped by the prize's sponsor, source, size, type or status, each line saying which station it is for.
  const lineGroups = useMemo(() => {
    if (!hasEvent || group === 'station') return [];
    const all: GroupLine[] = stationData.flatMap((x) => x.ls.map((l) => ({ ...l, station: x.s }))).filter((l) => matches(l.p, l.sponsor));
    const here = (l: GroupLine) => holds.get(l.p.id)?.total ?? 0;
    if (group === 'sponsor') return groupBy(all, (l) => l.sponsor, 'Club (no sponsor)');
    if (group === 'source') return groupBy(all, (l) => fromOf(l.p, l.sponsor, slugByPlan), 'Unknown');
    if (group === 'size') return groupBy(all, (l) => l.p.size, 'No size', sizeOrder);
    if (group === 'type') return groupBy(all, (l) => l.p.type, 'No type');
    return groupBy(
      all,
      (l) => STATUS_LABEL[statusOf(l.p, here(l))],
      'Other',
      STATUS_ORDER.map((x) => STATUS_LABEL[x]),
    );
  }, [hasEvent, group, stationData, matches, holds, slugByPlan, sizeOrder]);
  const stockValue = valueOf((prizes.rows ?? []).filter((p) => !isLoose(p)).map((p) => ({ quantity: p.quantity, price: p.price }))); // free merch is not counted or valued
  const hereValue = valueOf(lines.filter((l) => !isLoose(l.prize)).map((l) => ({ quantity: l.quantity, price: l.prize.price })));

  if (!list.plans || !prizes.rows)
    return (
      <div className={styles.tab}>{list.error || prizes.error ? <Notice tone="error">{list.error || prizes.error}</Notice> : <Loading variant="inline" label="Loading…" />}</div>
    );
  if (sheet)
    return (
      <div className={`${styles.tab} ${pz.page}`}>
        <div className={pz.top}>
          <ViewSwitch sheet go={(s) => go({ tab: 'prizing', plan: slug, ...(s ? { sheet: true } : {}) })} />
        </div>
        <div className={styles.sheetOnly}>
          <PrizingSheet api={api} data={data} prizes={prizes} />
        </div>
        <p className={styles.sheetPhone}>
          The sheet is for a laptop or a tablet.{' '}
          <button type="button" onClick={() => go({ tab: 'prizing', plan: slug })}>
            Use the cards
          </button>{' '}
          on a phone.
        </p>
      </div>
    );
  return (
    <div className={`${styles.tab} ${pz.page}`}>
      <div className={pz.top}>
        <ViewSwitch sheet={false} go={(s) => go({ tab: 'prizing', plan: slug, ...(s ? { sheet: true } : {}) })} />
        {list.plans.length > 0 && (
          <div className={pz.modeSeg}>
            <SectionTabs<'event' | 'stock'>
              variant="segmented"
              label="This event or the stock"
              value={chosen ? 'event' : 'stock'}
              onChange={(v) => go({ tab: 'prizing', plan: v === 'stock' ? 'stock' : lastEvent() })}
              tabs={[
                { id: 'event', label: 'This Event' },
                { id: 'stock', label: 'In Stock' },
              ]}
            />
          </div>
        )}
        {hasEvent && (
          <div className={pz.pick}>
            <Select value={chosen?.slug ?? ''} onChange={(e) => go({ tab: 'prizing', plan: e.target.value })} aria-label="Event">
              {list.plans.map((p) => (
                <option key={p.id} value={p.slug}>
                  {eventLabel(p)}
                </option>
              ))}
            </Select>
          </div>
        )}
        <div className={`${pz.pick} ${pz.pickSmall}`}>
          <Select value={group} onChange={(e) => change({ group: e.target.value as GroupBy })} aria-label="Group by">
            {GROUPS.filter((g) => hasEvent || g.id !== 'station').map((g) => (
              <option key={g.id} value={g.id}>
                Group by: {g.label}
              </option>
            ))}
          </Select>
        </div>
        <div className={`${styles.search} ${pz.search}`}>
          <Search size={15} aria-hidden="true" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search prizes: what’s left of…?" aria-label="Search prizes" />
        </div>
        <div className={pz.topEnd}>
          {data.canManage && (
            <Button className={styles.addBtn} onClick={() => setDialog({ kind: 'prize', prize: null })}>
              <Plus size={15} aria-hidden="true" /> Add<span className={styles.wide}>Prize</span>
            </Button>
          )}
          {data.canManage && (
            <button type="button" className={pz.gear} onClick={() => setDialog({ kind: 'settings' })} aria-label="Prizing settings" title="Sponsors, sizes and steps">
              <Settings2 size={17} aria-hidden="true" />
            </button>
          )}
          {data.canManage && hasEvent && (
            <RowMenu
              label="This event"
              items={[
                eventClosed
                  ? { label: 'Reopen This Event', onClick: () => void closer.reopen(chosen!.id) }
                  : { label: 'Close This Event', onClick: () => void closer.close(chosen!) },
              ]}
            />
          )}
        </div>
      </div>

      <div className={pz.stats}>
        <span>
          {prizes.rows.length} prizes · {money(stockValue) || '$0'} in stock
        </span>
        {hasEvent && (
          <span>
            This event: {lines.filter((l) => !isLoose(l.prize)).reduce((n, l) => n + l.quantity, 0)} assigned · {money(hereValue) || '$0'}
          </span>
        )}
        {!hasEvent && (
          <label className={pz.oneAtATime} title="Prizes with none left on hand, or a free prize that is out">
            <input type="checkbox" checked={view.hideGone} onChange={(e) => change({ hideGone: e.target.checked })} /> Hide given out
            {view.hideGone && goneCount > 0 ? ` (${goneCount})` : ''}
          </label>
        )}
        {data.canManage && !hasEvent && guesses.length > 0 && (
          <button type="button" className={pz.feedBtn} onClick={() => setPastOpen(true)}>
            Fill in {guesses.length} missing {guesses.length === 1 ? 'event' : 'events'} from past records
          </button>
        )}
        {eventClosed && <span className={pz.closedTag}>Closed: it holds nothing back, and stock was not changed by closing</span>}
        <span className={pz.foldTools}>
          <label className={pz.oneAtATime} title="Opening one folds the others">
            <input
              type="checkbox"
              checked={view.oneAtATime}
              onChange={(e) => {
                change({ oneAtATime: e.target.checked });
                setOpenStations({});
                setOpenGroups({});
                setOpenAll(false);
              }}
            />{' '}
            One at a time
          </label>
          {!view.oneAtATime &&
            (group === 'station' && hasEvent ? (
              <button type="button" className={pz.feedBtn} onClick={() => setAllStations(!shownStations.every((x) => stationOpen(x.s.id)))}>
                {shownStations.every((x) => stationOpen(x.s.id)) ? 'Close all' : 'Open all'}
              </button>
            ) : (
              <button
                type="button"
                className={pz.feedBtn}
                onClick={() => {
                  if (openAll) {
                    setOpenAll(false);
                    setOpenGroups({});
                  } else setOpenAll(true);
                }}
              >
                {openAll ? 'Close all' : 'Open all'}
              </button>
            ))}
        </span>
      </div>
      {hasEvent && !wide && steps.length > 0 && (
        <div className={pz.steps} role="group" aria-label="Event-day counters to show">
          <span className={pz.stepsLabel}>Counters</span>
          {steps.map((s) => {
            const on = shownSteps.some((x) => x.id === s.id);
            return (
              <button
                key={s.id}
                type="button"
                className={`${pz.stepChip} ${on ? pz.stepOn : ''}`}
                aria-pressed={on}
                onClick={() =>
                  change({
                    steps: on ? shownSteps.filter((x) => x.id !== s.id).map((x) => x.name.toLowerCase()) : [...shownSteps.map((x) => x.name.toLowerCase()), s.name.toLowerCase()],
                  })
                }
              >
                {s.name}
              </button>
            );
          })}
        </div>
      )}
      {prizes.error && (
        <div role="alert" onClick={() => prizes.setError('')}>
          <Notice tone="error">{prizes.error}</Notice>
        </div>
      )}
      {plan.error && (
        <div role="alert" onClick={() => plan.setError('')}>
          <Notice tone="error">{plan.error}</Notice>
        </div>
      )}
      <FixStrip fixes={fixes} onFocus={focus} />
      {hasEvent && manage && needy.length > 1 && (
        <div className={pz.fillAll}>
          <Button size="sm" variant="secondary" loading={!!filling} onClick={() => void fillAll()}>
            Suggest Prizes For {needy.length} Stations
          </Button>
          <span className={styles.muted}>Fills what each station asked for, sponsor prizes first.</span>
        </div>
      )}

      {group === 'station' && hasEvent ? (
        <div className={pz.blocks}>
          {shownStations.length === 0 && (
            <div className={styles.empty}>
              <p>No stations have prizes yet. {manage ? 'Add a station, then add prizes to it.' : ''}</p>
            </div>
          )}
          {shownStations
            .filter((x) => !q.trim() || x.s.name.toLowerCase().includes(q.trim().toLowerCase()) || x.ls.some((l) => matches(l.p, l.sponsor)))
            .map((x) => (
              <div key={x.s.id}>
                <StationBlock
                  station={x.s}
                  lines={x.ls.filter((l) => !q.trim() || matches(l.p, l.sponsor) || x.s.name.toLowerCase().includes(q.trim().toLowerCase()))}
                  ctx={ctx}
                  addable={(prizes.rows ?? []).filter((p) => p.left > 0 && !x.ls.some((l) => l.p.id === p.id))}
                  need={x.n.need}
                  asked={x.n.asked}
                  onAdd={(p) => void setLine(x.s.id, p, 1)}
                  onFill={Object.keys(x.n.need).length > 0 && manage ? () => void fillOne(x.s.id) : undefined}
                  onEdit={() => setDialog({ kind: 'station', station: x.s })}
                  onRemove={() => void removeStation(x.s)}
                  onLock={manage && x.s.prize_request_id ? () => void lockStation(x.s, !isLocked(x.s)) : undefined}
                  flash={flash === x.s.id}
                  open={stationOpen(x.s.id)}
                  onToggle={() => toggleStation(x.s.id)}
                  summary={(stepId) => {
                    const st = steps.find((s) => s.id === stepId);
                    if (!st) return null;
                    return {
                      total: x.ls.reduce((n, l) => n + stepCeiling(st, l, givenOf(l.id)), 0),
                      done: x.ls.reduce((n, l) => n + shown(l.id, stepId, stepCeiling(st, l, givenOf(l.id))), 0),
                    };
                  }}
                  onAll={
                    manage || (hasEvent && !eventClosed)
                      ? (stepId) => {
                          const st = steps.find((s) => s.id === stepId);
                          if (st) void markAll(x.s.id, st);
                        }
                      : undefined
                  }
                />
                {(filling === x.s.id || shortOf[x.s.id]) && <p className={pz.muted}>{filling === x.s.id ? 'Choosing prizes…' : shortOf[x.s.id]}</p>}
              </div>
            ))}
          {manage && (
            <div className={pz.addStation}>
              <Button size="sm" variant="secondary" onClick={() => setDialog({ kind: 'addStation' })}>
                <Plus size={14} aria-hidden="true" /> Add Station
              </Button>
            </div>
          )}
        </div>
      ) : hasEvent ? (
        <div className={pz.blocks}>
          {lineGroups.length === 0 && (
            <div className={styles.empty}>
              <p>{q.trim() ? 'Nothing matches.' : 'No prizes are in this event yet.'}</p>
            </div>
          )}
          {lineGroups.map((g) => (
            <GroupBlock
              key={g.key}
              id={`group-${group}-${g.key}`}
              label={g.label}
              lines={g.rows}
              ctx={ctx}
              open={groupOpen(g.key)}
              onToggle={() => toggleGroup(g.key)}
              summary={(stepId) => {
                const st = steps.find((z) => z.id === stepId);
                if (!st) return null;
                return {
                  total: g.rows.reduce((n, l) => n + stepCeiling(st, l, givenOf(l.id)), 0),
                  done: g.rows.reduce((n, l) => n + shown(l.id, stepId, stepCeiling(st, l, givenOf(l.id))), 0),
                };
              }}
              onAll={
                manage || !eventClosed
                  ? (stepId) => {
                      const st = steps.find((z) => z.id === stepId);
                      if (!st) return;
                      void (async () => {
                        for (const l of g.rows) {
                          const c = stepCeiling(st, l, givenOf(l.id));
                          if (c > 0 && count(l.id, st.id) < c) await plan.setPrizeCount(l.id, st.id, c);
                        }
                      })();
                    }
                  : undefined
              }
            />
          ))}
        </div>
      ) : (
        <div className={pz.blocks}>
          {groups.every((g) => g.rows.length === 0) && (
            <div className={styles.empty}>
              <p>{rows.length === 0 ? 'No prizes yet. Add the first one.' : 'Nothing matches.'}</p>
            </div>
          )}
          {groups
            .filter((g) => g.rows.length > 0)
            .map((g) => (
              <StockBlock key={g.key} id={`stock-${group}-${g.key}`} label={g.label} rows={g.rows} ctx={ctx} open={groupOpen(g.key)} onToggle={() => toggleGroup(g.key)} />
            ))}
        </div>
      )}

      {dialog?.kind === 'prize' && (
        <PrizeEditor
          prizes={prizes}
          api={api}
          data={data}
          prize={dialog.prize}
          tab={dialog.tab}
          fromText={dialog.prize ? fromOf(dialog.prize, dialog.prize.sponsor_id ? (sponsorName.get(dialog.prize.sponsor_id) ?? null) : null, slugByPlan) : ''}
          events={(list.plans ?? []).map((p) => ({ id: p.id, name: p.name, slug: p.slug, starts_on: p.starts_on }))}
          defaultEvent={chosen ? { id: chosen.id, name: chosen.name } : null}
          onClose={() => setDialog(null)}
        />
      )}
      {pastOpen && (
        <PastEventsDialog
          guesses={guesses}
          onDone={() => {
            void prizes.reload();
            loadGuesses();
          }}
          onClose={() => setPastOpen(false)}
        />
      )}
      {dialog?.kind === 'settings' && <PrizingSettings api={api} data={data} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'station' && <StationDialog plan={plan} station={dialog.station} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'addStation' && <AddStationDialog plan={plan} existing={addableStations} onClose={() => setDialog(null)} />}
      <LivePill people={team.here} live={team.live} feed={feed} describe={describeKey} />
    </div>
  );
}

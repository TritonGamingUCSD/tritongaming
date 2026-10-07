'use client';

import { MoveHorizontal, MoveVertical, Pointer } from 'lucide-react';
import Button from '@/components/ui/Button';
import { useEffect, useRef, useState } from 'react';
import { confirmHold } from '@/lib/ui/confirmHold';
import { busySlots, clockLabel, dayLabel, slotStarts, toHhmm, toMin, type PlanSlots, type PlanView, type SlotValue } from '@/lib/meetings/meetingPlans';
import styles from './planning.module.css';

type Mode = 0 | 1 | 2;

// A matchMedia hook: on a phone the mode picker sits above the grid, and touch has its own press-and-hold painting.
function useNarrow() {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const q = window.matchMedia('(max-width: 719px)');
    const on = () => setNarrow(q.matches);
    on();
    q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  }, []);
  return narrow;
}

const MODES: { id: Mode; label: string; hint: string; cls: string }[] = [
  { id: 1, label: 'Available', hint: 'I can make this', cls: 'mAvail' },
  { id: 2, label: 'If needed', hint: 'I would rather not, but could', cls: 'mMaybe' },
  { id: 0, label: 'Unavailable', hint: 'Clear it', cls: 'mNo' },
];

// Mark when you are free: click or drag cells with a mouse; on a phone tap a cell, drag up or down a day to paint a run of times, and swipe sideways
// to move through the days (the same grid as on a desktop). Anything left blank means unavailable.
export default function AvailabilityGrid({ plan, value, onChange, disabled }: { plan: PlanView; value: PlanSlots; onChange: (next: PlanSlots) => void; disabled?: boolean }) {
  const narrow = useNarrow();
  const [mode, setMode] = useState<Mode>(1);
  const starts = slotStarts(plan.window_start, plan.window_end);
  const days = plan.days;
  const drag = useRef<{ day: string; value: Mode } | null>(null);
  // What the pointer is over, so the time and day can be read right at the cursor (and highlighted on the edges) instead of looking back along the grid.
  const [hover, setHover] = useState<{ day: string; t: string; x: number; y: number } | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  useEffect(() => {
    const up = () => { drag.current = null; };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => { window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
  }, []);

  // Times already on my Triton Gaming calendar: unavailable for sure, locked.
  const busyBy = new Map(days.map((d) => [d, busySlots(plan.busy, d, starts)]));
  const isBusy = (day: string, t: string) => busyBy.get(day)?.has(t) ?? false;
  const busyTitle = (day: string, t: string) => busyBy.get(day)?.get(t) ?? '';
  const busyWhy = (day: string, t: string) => plan.busy.find((b) => b.day === day && b.title === busyTitle(day, t))?.why ?? '';
  // On my Google Calendar: a hint only. These times stay clickable and count as I mark them.
  const softBy = new Map(days.map((d) => [d, busySlots(plan.soft ?? [], d, starts)]));
  const softTitle = (day: string, t: string) => softBy.get(day)?.get(t) ?? '';
  const isSoft = (day: string, t: string) => !isBusy(day, t) && softBy.get(day)?.has(t) === true;
  const hasAnything = Object.keys(value).length > 0;

  // Touch, with no modes: the cells let the browser handle sideways swipes only (CSS touch-action: pan-x), so a swipe sideways scrolls through the days,
  // and a drag that starts going up or down paints a run of times straight away. A tap marks one cell. To scroll the page, touch the time column (or
  // anywhere outside the cells). The handlers are native because stopping a scroll mid-paint needs a non-passive touchmove.
  const tableRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [painting, setPainting] = useState(false);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const api = useRef({ read: (_d: string, _t: string): Mode => 0, paint: (_d: string, _t: string, _v: Mode) => {}, off: false });
  useEffect(() => {
    const el = tableRef.current;
    if (!el) return;
    let edge: ReturnType<typeof setInterval> | undefined;
    let start: { x: number; y: number; d: string; t: string } | null = null;
    let active = false;
    let value: Mode = 1;
    let last = '';
    let lastX = 0;
    let lastY = 0;
    const cellAt = (x: number, y: number) => { const n = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest('[data-cell]') as HTMLElement | null; return n ? { d: n.dataset.d as string, t: n.dataset.t as string } : null; };
    const stop = () => { clearInterval(edge); edge = undefined; if (active) { active = false; setPainting(false); } start = null; last = ''; };
    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1 || api.current.off) { stop(); return; }
      const t = e.touches[0];
      const c = cellAt(t.clientX, t.clientY);
      start = c ? { x: t.clientX, y: t.clientY, ...c } : null;
      lastX = t.clientX; lastY = t.clientY;
    };
    const onMove = (e: TouchEvent) => {
      const t = e.touches[0];
      lastX = t.clientX; lastY = t.clientY;
      if (!active) {
        if (!start) return;
        const dx = t.clientX - start.x, dy = t.clientY - start.y;
        if (Math.abs(dy) < 8 || Math.abs(dy) < Math.abs(dx)) return;   // not going up or down (yet): a sideways swipe belongs to the grid's own scroll
        active = true; setPainting(true);
        value = api.current.read(start.d, start.t) === modeRef.current ? 0 : modeRef.current;
        api.current.paint(start.d, start.t, value);
        last = `${start.d}|${start.t}`;
        try { navigator.vibrate?.(8); } catch { /* not every phone can */ }
        // A finger held near an edge keeps things moving, so a long run can be painted past the visible part.
        edge = setInterval(() => {
          const w = wrapRef.current;
          if (w) { const r = w.getBoundingClientRect(); if (lastX > r.right - 36) w.scrollLeft += 8; else if (lastX < r.left + 100) w.scrollLeft -= 8; }
          if (lastY < 90) window.scrollBy(0, -10); else if (lastY > window.innerHeight - 150) window.scrollBy(0, 10);
        }, 16);
      }
      if (e.cancelable) e.preventDefault();
      const c = cellAt(t.clientX, t.clientY);
      if (c && `${c.d}|${c.t}` !== last) { last = `${c.d}|${c.t}`; api.current.paint(c.d, c.t, value); }
    };
    const onEnd = (e: TouchEvent) => {
      if (active) { if (e.cancelable) e.preventDefault(); }
      else if (start && Math.hypot(lastX - start.x, lastY - start.y) < 10) {   // a tap: toggle that one cell
        api.current.paint(start.d, start.t, api.current.read(start.d, start.t) === modeRef.current ? 0 : modeRef.current);
        if (e.cancelable) e.preventDefault();
      }
      stop();
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd, { passive: false });
    el.addEventListener('touchcancel', stop, { passive: true });
    return () => { stop(); el.removeEventListener('touchstart', onStart); el.removeEventListener('touchmove', onMove); el.removeEventListener('touchend', onEnd); el.removeEventListener('touchcancel', stop); };
  }, []);
  async function clearEverything() {
    if (await confirmHold({ title: 'Clear everything?', message: 'This clears every time you marked on this plan, so you’d be unavailable for all of it (times already blocked by your calendar stay blocked).', confirmLabel: 'Hold to clear everything' })) onChange({});
  }
  const get = (day: string, t: string): Mode => (isBusy(day, t) ? 0 : (value[day]?.[t] ?? 0)) as Mode;
  function setCells(cells: { day: string; t: string }[], v: Mode) {
    const next: PlanSlots = { ...valueRef.current };
    for (const { day, t } of cells.filter((c) => !isBusy(c.day, c.t))) {
      const row = { ...(next[day] ?? {}) };
      if (v === 0) delete row[t]; else row[t] = v as SlotValue;
      if (Object.keys(row).length) next[day] = row; else delete next[day];
    }
    valueRef.current = next;   // so two paints in the same instant (a fast drag) build on each other
    onChange(next);
  }
  api.current = { read: (d, t) => get(d, t), paint: (d, t, v) => setCells([{ day: d, t }], v), off: !!disabled };
  const dayFull = (day: string) => { const open = starts.filter((t) => !isBusy(day, t)); return open.length > 0 && open.every((t) => get(day, t) === mode); };
  const fillDay = (day: string, v: Mode, from = 0, to = 24 * 60) => setCells(starts.filter((t) => toMin(t) >= from && toMin(t) < to).map((t) => ({ day, t })), v);

  const head = (day: string) => dayLabel(day, plan.kind);
  const cellClass = (v: Mode) => `${styles.cell} ${v === 1 ? styles.cellAvail : v === 2 ? styles.cellMaybe : ''}`;

  // Why some times are already blocked: each one is on the person's own Triton Gaming calendar.
  const blockedPanel = plan.busy.length > 0 ? (
    <div className={styles.busyNote} role="note">
      <strong>Some times are already blocked off for you</strong>
      <span>They’re on your Triton Gaming calendar, so you’re unavailable then and can’t mark them.</span>
      <ul>
        {[...new Map(plan.busy.map((b) => [`${b.day}|${b.start}|${b.title}`, b])).values()].map((b) => (
          <li key={`${b.day}|${b.start}|${b.title}`}><b>{b.title}</b>: {dayLabel(b.day, plan.kind)}, {clockLabel(b.start)} to {clockLabel(b.end)} <i>({b.why})</i></li>
        ))}
      </ul>
    </div>
  ) : null;

  const modeBar = (
    <div className={styles.modeBar} role="radiogroup" aria-label="What to mark">
      {MODES.map((m) => (
        <button key={m.id} type="button" role="radio" aria-checked={mode === m.id} className={`${styles.modeBtn} ${styles[m.cls]} ${mode === m.id ? styles.modeOn : ''}`} onClick={() => setMode(m.id)} disabled={disabled}>
          <span className={styles.modeDot} aria-hidden="true" />
          <span>{m.label}<em>{m.hint}</em></span>
        </button>
      ))}
    </div>
  );

  return (
    <div className={styles.availLayout} data-fill-width>
      <div className={styles.availMain}>
      {narrow && (
        <div className={styles.phoneTop}>
          {modeBar}
          <p className={styles.gestures}><span><Pointer size={14} aria-hidden="true" /> Tap</span><span><MoveVertical size={14} aria-hidden="true" /> Drag to paint</span><span><MoveHorizontal size={14} aria-hidden="true" /> Swipe for days</span></p>
        </div>
      )}
      <div className={`${styles.gridWrap} ${painting ? styles.painting : ''}`} ref={wrapRef}>
        <div className={`${styles.gridTable}`} ref={tableRef} onContextMenu={(e) => e.preventDefault()} style={{ gridTemplateColumns: `var(--timeW) repeat(${days.length}, var(--colW))` }} onPointerLeave={() => { drag.current = null; setHover(null); }}>
          <div className={styles.corner} />
          {days.map((d) => (
            <div key={d} className={`${styles.colHead} ${hover?.day === d ? styles.hot : ''}`}>
              <span>{head(d)}</span>
              <button type="button" className={styles.colAll} onClick={() => fillDay(d, dayFull(d) ? 0 : mode)} disabled={disabled} title={dayFull(d) ? 'Clear this whole day' : 'Mark this whole day with the selected mode'}>{dayFull(d) ? 'Clear day' : 'Fill day'}</button>
            </div>
          ))}
          {starts.map((t) => (
            <div key={t} style={{ display: 'contents' }}>
              <div className={`${styles.timeLbl} ${t.endsWith(':00') ? '' : styles.timeHalf} ${hover?.t === t ? styles.timeHot : ''}`}>{t.endsWith(':00') || hover?.t === t ? clockLabel(t) : ''}</div>
              {days.map((d) => {
                const v = get(d, t);
                if (isBusy(d, t)) {
                  // The block's first slot carries its name, so it is clear on the grid itself why the time is taken.
                  const prev = toHhmm(toMin(t) - 30);
                  const first = !isBusy(d, prev) || busyTitle(d, prev) !== busyTitle(d, t);
                  return <div key={d} onPointerMove={(e) => setHover({ day: d, t, x: e.clientX, y: e.clientY })} className={`${styles.cell} ${styles.cellBusy} ${t.endsWith(':00') ? '' : styles.cellHalf}`} title={`Blocked: ${busyTitle(d, t)} (${busyWhy(d, t)})`} aria-label={`${head(d)} ${clockLabel(t)}: busy, ${busyTitle(d, t)}`}>{first && <span className={styles.busyLabel}>{busyTitle(d, t)}</span>}</div>;
                }
                return (
                  <div
                    key={d}
                    className={`${cellClass(v)} ${t.endsWith(':00') ? '' : styles.cellHalf} ${isSoft(d, t) ? styles.cellSoft : ''}`}
                    role="button"
                    data-cell=""
                    data-d={d}
                    data-t={t}
                    tabIndex={disabled ? -1 : 0}
                    aria-label={`${head(d)} ${clockLabel(t)}: ${v === 1 ? 'available' : v === 2 ? 'if needed' : 'unavailable'}${isSoft(d, t) ? `, on your Google Calendar: ${softTitle(d, t)}` : ''}`}
                    onPointerDown={(e) => {
                      if (disabled || e.pointerType === 'touch') return;
                      const next: Mode = v === mode ? 0 : mode;
                      drag.current = { day: d, value: next };
                      setCells([{ day: d, t }], next);
                    }}
                    onPointerEnter={(e) => { if (!disabled && drag.current && e.buttons === 1) setCells([{ day: d, t }], drag.current.value); }}
                    onPointerMove={(e) => { if (e.pointerType !== 'touch') setHover({ day: d, t, x: e.clientX, y: e.clientY }); }}
                    onKeyDown={(e) => { if (!disabled && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setCells([{ day: d, t }], v === mode ? 0 : mode); } }}
                  >{isSoft(d, t) && !isSoft(d, toHhmm(toMin(t) - 30)) && <span className={styles.softLabel}>{softTitle(d, t)}</span>}</div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      </div>
      {hover && (
        <div className={styles.hoverTip} style={{ left: hover.x + 14, top: hover.y + 16 }} aria-hidden="true">
          {head(hover.day)} · {clockLabel(hover.t)} to {clockLabel(toHhmm(toMin(hover.t) + 30))}
          {isBusy(hover.day, hover.t) && <em>Blocked: {busyTitle(hover.day, hover.t)}</em>}
          {isSoft(hover.day, hover.t) && <em>Google Calendar: {softTitle(hover.day, hover.t)} (you can still mark it)</em>}
        </div>
      )}
      <aside className={styles.availSide}>
        {!narrow && modeBar}
        {!narrow && <p className={styles.hint}>Click or drag to mark times. Blank = unavailable.</p>}
        {blockedPanel}
        <Button size="sm" variant="danger" onClick={clearEverything} disabled={disabled || !hasAnything}>Clear everything</Button>
      </aside>
    </div>
  );
}

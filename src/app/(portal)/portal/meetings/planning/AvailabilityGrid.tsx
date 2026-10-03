'use client';

import Button from '@/components/ui/Button';
import { useEffect, useRef, useState } from 'react';
import { confirmHold } from '@/lib/confirmHold';
import { busySlots, clockLabel, dayLabel, slotStarts, toHhmm, toMin, type PlanSlots, type PlanView, type SlotValue } from '@/lib/meetingPlans';
import styles from './planning.module.css';

type Mode = 0 | 1 | 2;

// A matchMedia hook: the phone gets one day at a time, bigger rows.
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

// Mark when you are free: tap or drag cells (a day at a time on a phone). Anything left blank means unavailable.
export default function AvailabilityGrid({ plan, value, onChange, disabled }: { plan: PlanView; value: PlanSlots; onChange: (next: PlanSlots) => void; disabled?: boolean }) {
  const narrow = useNarrow();
  const [mode, setMode] = useState<Mode>(1);
  const [dayIdx, setDayIdx] = useState(0);
  const starts = slotStarts(plan.window_start, plan.window_end);
  const days = plan.days;
  const drag = useRef<{ day: string; value: Mode } | null>(null);
  // What the pointer is over, so the time and day can be read right at the cursor (and highlighted on the edges) instead of looking back along the grid.
  const [hover, setHover] = useState<{ day: string; t: string; x: number; y: number } | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  useEffect(() => { if (dayIdx >= days.length) setDayIdx(0); }, [days.length, dayIdx]);
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
    onChange(next);
  }
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

  if (narrow) {
    const day = days[Math.min(dayIdx, days.length - 1)];
    return (
      <div className={styles.gridBlock}>
        {modeBar}
        <div className={styles.dayChips} role="tablist" aria-label="Day">
          {days.map((d, i) => {
            const n = Object.keys(value[d] ?? {}).length;
            return (
              <button key={d} type="button" role="tab" aria-selected={i === dayIdx} className={`${styles.dayChip} ${i === dayIdx ? styles.dayChipOn : ''}`} onClick={() => setDayIdx(i)}>
                {head(d)}{n > 0 && <span className={styles.dayDot} aria-label={`${n} slots marked`} />}
              </button>
            );
          })}
        </div>
        <div className={styles.quick}>
          <Button size="sm" variant="secondary" onClick={() => fillDay(day, mode, 0, 12 * 60)} disabled={disabled}>Morning</Button>
          <Button size="sm" variant="secondary" onClick={() => fillDay(day, mode, 12 * 60, 17 * 60)} disabled={disabled}>Afternoon</Button>
          <Button size="sm" variant="secondary" onClick={() => fillDay(day, mode, 17 * 60)} disabled={disabled}>Evening</Button>
          <Button size="sm" variant="secondary" onClick={() => fillDay(day, mode)} disabled={disabled}>Whole day</Button>
          <Button size="sm" variant="danger" onClick={() => fillDay(day, 0)} disabled={disabled}>Clear day</Button>
          <Button size="sm" variant="danger" onClick={clearEverything} disabled={disabled || !hasAnything}>Clear everything</Button>
        </div>
        {plan.busy.length > 0 && <p className={styles.hint}>Greyed times are already on your Triton Gaming calendar, so you are unavailable then.</p>}
        {(plan.soft ?? []).length > 0 && <p className={styles.hint}>Teal striped times are on your Google Calendar. Only you see them, and they don’t block you: you still decide.</p>}
        <div className={styles.mRows}>
          {starts.map((t) => {
            const v = get(day, t);
            const busy = isBusy(day, t);
            if (busy) return (
              <div key={t} className={`${styles.mRow} ${styles.mBusy}`} aria-label={`${head(day)} ${clockLabel(t)}: busy, ${busyTitle(day, t)}`}>
                <span className={styles.mTime}>{clockLabel(t)}</span>
                <span className={styles.mBusyText}>Blocked · {busyTitle(day, t)}</span>
              </div>
            );
            return (
              <button key={t} type="button" disabled={disabled} className={`${styles.mRow} ${v === 1 ? styles.cellAvail : v === 2 ? styles.cellMaybe : ''}`} onClick={() => setCells([{ day, t }], v === mode ? 0 : mode)} aria-pressed={v !== 0} aria-label={`${head(day)} ${clockLabel(t)}: ${v === 1 ? 'available' : v === 2 ? 'if needed' : 'unavailable'}`}>
                <span className={styles.mTime}>{clockLabel(t)}{isSoft(day, t) && <span className={styles.mSoft}>Google: {softTitle(day, t)}</span>}</span>
                <span className={styles.mState}>{v === 1 ? 'Available' : v === 2 ? 'If needed' : ''}</span>
              </button>
            );
          })}
        </div>
        {blockedPanel}
      </div>
    );
  }

  return (
    <div className={styles.availLayout} data-fill-width>
      <div className={styles.availMain}>
      <div className={styles.gridWrap}>
        <div className={styles.gridTable} style={{ gridTemplateColumns: `64px repeat(${days.length}, 96px)` }} onPointerLeave={() => { drag.current = null; setHover(null); }}>
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
                  const first = !isBusy(d, toHhmm(toMin(t) - 30));
                  return <div key={d} onPointerMove={(e) => setHover({ day: d, t, x: e.clientX, y: e.clientY })} className={`${styles.cell} ${styles.cellBusy} ${t.endsWith(':00') ? '' : styles.cellHalf}`} title={`Blocked: ${busyTitle(d, t)} (${busyWhy(d, t)})`} aria-label={`${head(d)} ${clockLabel(t)}: busy, ${busyTitle(d, t)}`}>{first && <span className={styles.busyLabel}>{busyTitle(d, t)}</span>}</div>;
                }
                return (
                  <div
                    key={d}
                    className={`${cellClass(v)} ${t.endsWith(':00') ? '' : styles.cellHalf} ${isSoft(d, t) ? styles.cellSoft : ''}`}
                    role="button"
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
                    onClick={(e) => { if (!disabled && (e as unknown as PointerEvent).pointerType === 'touch') setCells([{ day: d, t }], v === mode ? 0 : mode); }}
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
        {modeBar}
        <p className={styles.hint}>Click or drag on the grid to mark times. Anything you leave blank counts as unavailable. Use <b>fill</b> and <b>clear</b> above a day for the whole day.</p>
        {blockedPanel}
        <Button size="sm" variant="danger" onClick={clearEverything} disabled={disabled || !hasAnything}>Clear everything</Button>
      </aside>
    </div>
  );
}

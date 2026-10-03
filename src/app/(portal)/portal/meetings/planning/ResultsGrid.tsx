'use client';

import { useEffect, useRef, useState } from 'react';
import { canStartAt, clockLabel, dayLabel, evaluateStart, slotStarts, toHhmm, toMin, type PlanView } from '@/lib/meetingPlans';
import styles from './planning.module.css';

// The group's answers as a heat map: the deeper the green, the more people can make that half hour. Tap a cell to see who, and
// (for the host) to pick the meeting time starting there.
export default function ResultsGrid({ plan, selected, onSelect, preview }: { plan: PlanView; selected: { day: string; start: string } | null; onSelect: (s: { day: string; start: string }) => void; preview?: { day: string; start: string } | null }) {
  const [narrow, setNarrow] = useState(false);
  const [dayIdx, setDayIdx] = useState(0);
  const [hover, setHover] = useState<{ day: string; t: string; x: number; y: number } | null>(null);
  useEffect(() => {
    const q = window.matchMedia('(max-width: 719px)');
    const on = () => setNarrow(q.matches);
    on(); q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  }, []);
  // On a phone only one day shows, so follow a previewed time to its day.
  const block = useRef<HTMLDivElement>(null);
  // If the previewed time is scrolled out of sight sideways in the grid, slide it into view (never scrolls the page itself).
  useEffect(() => {
    const el = block.current?.querySelector('[data-preview]') as HTMLElement | null;
    const wrap = block.current?.querySelector('[data-gridwrap]') as HTMLElement | null;
    if (!preview || !el || !wrap) return;
    const e = el.getBoundingClientRect(), w = wrap.getBoundingClientRect();
    if (e.left < w.left + 64) wrap.scrollLeft -= w.left + 64 - e.left;
    else if (e.right > w.right) wrap.scrollLeft += e.right - w.right;
  }, [preview]);
  useEffect(() => { if (preview) { const i = plan.days.indexOf(preview.day); if (i >= 0) setDayIdx(i); } }, [preview, plan.days]);
  const starts = slotStarts(plan.window_start, plan.window_end);
  const days = plan.days;
  const total = Math.max(1, plan.people.length);

  // Per cell: who is available / if needed for that single half hour.
  const cell = (day: string, t: string) => {
    let a = 0, m = 0;
    for (const p of plan.people) {
      const v = plan.responses[p.id]?.[day]?.[t];
      if (v === 1) a++; else if (v === 2) m++;
    }
    return { a, m, ratio: (a + 0.5 * m) / total };
  };
  const style = (day: string, t: string) => {
    const { ratio } = cell(day, t);
    return ratio > 0 ? { background: `rgba(52, 211, 153, ${0.12 + ratio * 0.78})` } : undefined;
  };
  // The meeting covers `duration` from the chosen start; mark those cells.
  const inSelection = (day: string, t: string) => !!selected && selected.day === day && toMin(t) >= toMin(selected.start) && toMin(t) < toMin(selected.start) + plan.duration_min;
  // A time being previewed from the Best times list (pointing at it): lit up in its own color across the whole meeting length.
  const inPreview = (day: string, t: string) => !!preview && preview.day === day && toMin(t) >= toMin(preview.start) && toMin(t) < toMin(preview.start) + plan.duration_min;
  const startOk = (t: string) => canStartAt(plan, t);

  const render = (day: string, t: string, big: boolean) => {
    const c = cell(day, t);
    const sel = inSelection(day, t);
    return (
      <button
        key={`${day}-${t}`}
        type="button"
        className={`${big ? styles.mRow : styles.heat} ${sel ? styles.heatSel : ''} ${inPreview(day, t) ? styles.heatPreview : ''} ${startOk(t) ? '' : styles.heatNoStart}`}
        style={style(day, t)}
        data-preview={inPreview(day, t) ? '' : undefined}
        onPointerMove={(e) => { if (!big && e.pointerType !== 'touch') setHover({ day, t, x: e.clientX, y: e.clientY }); }}
        onClick={() => onSelect({ day, start: startOk(t) ? t : toHhmm(Math.max(toMin(plan.window_start), Math.min(toMin(t), toMin(plan.window_end) - plan.duration_min))) })}
        aria-label={`${dayLabel(day, plan.kind)} ${clockLabel(t)}: ${c.a} available, ${c.m} if needed`}
      >
        {big && <span className={styles.mTime}>{clockLabel(t)}</span>}
        <span className={big ? styles.mState : styles.heatNum}>{c.a + c.m > 0 ? `${c.a}${c.m ? `+${c.m}` : ''}` : ''}</span>
      </button>
    );
  };

  if (narrow) {
    const day = days[Math.min(dayIdx, days.length - 1)];
    return (
      <div className={styles.gridBlock}>
        <div className={styles.dayChips} role="tablist" aria-label="Day">
          {days.map((d, i) => <button key={d} type="button" role="tab" aria-selected={i === dayIdx} className={`${styles.dayChip} ${i === dayIdx ? styles.dayChipOn : ''}`} onClick={() => setDayIdx(i)}>{dayLabel(d, plan.kind)}</button>)}
        </div>
        <div className={styles.mRows}>{starts.map((t) => render(day, t, true))}</div>
        <Legend total={plan.people.length} />
      </div>
    );
  }
  return (
    <div className={styles.gridBlock} ref={block}>
      <div className={styles.gridWrap} data-gridwrap>
        <div className={styles.gridTable} style={{ gridTemplateColumns: `64px repeat(${days.length}, 96px)` }} onPointerLeave={() => setHover(null)}>
          <div className={styles.corner} />
          {days.map((d) => <div key={d} className={`${styles.colHead} ${hover?.day === d ? styles.hot : ''} ${preview?.day === d ? styles.previewHead : ''}`}><span>{dayLabel(d, plan.kind)}</span></div>)}
          {starts.map((t) => (
            <div key={t} style={{ display: 'contents' }}>
              <div className={`${styles.timeLbl} ${t.endsWith(':00') ? '' : styles.timeHalf} ${hover?.t === t ? styles.timeHot : ''} ${preview && inPreview(preview.day, t) ? styles.previewTime : ''}`}>{t.endsWith(':00') || hover?.t === t || (preview && inPreview(preview.day, t) && t === preview.start) ? clockLabel(t) : ''}</div>
              {days.map((d) => render(d, t, false))}
            </div>
          ))}
        </div>
      </div>
      {hover && (() => { const c = cell(hover.day, hover.t); return (
        <div className={styles.hoverTip} style={{ left: hover.x + 14, top: hover.y + 16 }} aria-hidden="true">
          {dayLabel(hover.day, plan.kind)} · {clockLabel(hover.t)}
          <em>{c.a} available{c.m ? `, ${c.m} if needed` : ''}</em>
        </div>
      ); })()}
      <Legend total={plan.people.length} />
    </div>
  );
}

function Legend({ total }: { total: number }) {
  return <p className={styles.hint}>Each cell shows how many of the {total} {total === 1 ? 'person' : 'people'} are free (a second number adds “if needed”). Tap a cell to see who.</p>;
}

// Who is free for a meeting of the plan's length starting at day/start.
export function WhoPanel({ plan, pick }: { plan: PlanView; pick: { day: string; start: string } }) {
  const t = evaluateStart(pick.day, pick.start, plan.duration_min, plan.people, plan.responses, plan.blocked);
  const end = toHhmm(toMin(pick.start) + plan.duration_min);
  const names = (list: { name: string }[]) => list.map((p) => p.name).join(', ');
  return (
    <div className={styles.who}>
      <strong>{dayLabel(pick.day, plan.kind)}, {clockLabel(pick.start)} to {clockLabel(end)}</strong>
      <p><span className={styles.dotGreen} /> Available ({t.available.length}): {names(t.available) || 'nobody'}</p>
      {t.ifNeeded.length > 0 && <p><span className={styles.dotAmber} /> If needed ({t.ifNeeded.length}): {names(t.ifNeeded)}</p>}
      <p><span className={styles.dotGrey} /> Can’t ({t.unavailable.length}): {t.unavailable.map((p) => { const b = t.blocked.find((x) => x.person.id === p.id); return b ? `${p.name} (booked: ${b.titles.join(', ')})` : p.name; }).join(', ') || 'nobody'}</p>
      {t.noResponse.length > 0 && <p><span className={styles.dotHollow} /> Haven’t answered ({t.noResponse.length}): {names(t.noResponse)}</p>}
    </div>
  );
}

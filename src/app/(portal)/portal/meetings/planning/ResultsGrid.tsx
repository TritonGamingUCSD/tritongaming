'use client';

import { useEffect, useRef, useState } from 'react';
import { CalendarClock, CalendarX, Check, CircleHelp, Hourglass, X } from 'lucide-react';
import { canStartAt, clockLabel, dayLabel, evaluateStart, slotStarts, toHhmm, toMin, type PlanView } from '@/lib/meetings/meetingPlans';
import styles from './planning.module.css';

// The group's answers as a heat map: the number is how many people can make that half hour, and the deeper the green, the more of them. Amber
// stripes (the same as the "If needed" button on the availability grid) mean some of them can only if needed. A green outline marks times that work for
// everyone. Tap a cell to see who, and (for the host) to pick the meeting time starting there. The same grid on a phone: swipe sideways to move through the days.
const STRIPES = 'repeating-linear-gradient(135deg, rgba(251, 191, 36, 0.42) 0 3px, transparent 3px 9px)';
export default function ResultsGrid({ plan, selected, onSelect, preview }: { plan: PlanView; selected: { day: string; start: string } | null; onSelect: (s: { day: string; start: string }) => void; preview?: { day: string; start: string } | null }) {
  const [hover, setHover] = useState<{ day: string; t: string; x: number; y: number } | null>(null);
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
    return { a, m, can: a + m, ratio: (a + m) / total };
  };
  // Can the whole group make this half hour (some maybe only if needed)?
  const everyone = plan.people.length;
  const fits = (day: string, t: string) => everyone > 0 && cell(day, t).can === everyone;
  const ifNeededNames = (day: string, t: string) => plan.people.filter((p) => plan.responses[p.id]?.[day]?.[t] === 2).map((p) => p.name);
  const style = (day: string, t: string) => {
    const { ratio, m } = cell(day, t);
    // Light text on the faint cells, dark text on the deep green ones, so the number always reads.
    return ratio > 0 ? { backgroundColor: `rgba(52, 211, 153, ${0.12 + ratio * 0.78})`, backgroundImage: m > 0 ? STRIPES : undefined, color: ratio >= 0.45 ? '#04140e' : 'rgba(242, 241, 240, 0.92)' } : undefined;
  };
  // The meeting covers `duration` from the chosen start; mark those cells.
  const inSelection = (day: string, t: string) => !!selected && selected.day === day && toMin(t) >= toMin(selected.start) && toMin(t) < toMin(selected.start) + plan.duration_min;
  // A time being previewed from the Best times list (pointing at it): lit up in its own color across the whole meeting length.
  const inPreview = (day: string, t: string) => !!preview && preview.day === day && toMin(t) >= toMin(preview.start) && toMin(t) < toMin(preview.start) + plan.duration_min;
  const startOk = (t: string) => canStartAt(plan, t);

  const render = (day: string, t: string) => {
    const c = cell(day, t);
    const sel = inSelection(day, t);
    // A run of times that work for everyone is outlined as one block: the outline closes at the first and last cell of the run.
    const f = fits(day, t);
    const outline = f ? `${styles.fitAll} ${fits(day, toHhmm(toMin(t) - 30)) ? '' : styles.runTop} ${fits(day, toHhmm(toMin(t) + 30)) ? '' : styles.runBottom}` : '';
    return (
      <button
        key={`${day}-${t}`}
        type="button"
        className={`${styles.heat} ${outline} ${sel ? styles.heatSel : ''} ${inPreview(day, t) ? styles.heatPreview : ''} ${startOk(t) ? '' : styles.heatNoStart}`}
        style={style(day, t)}
        data-preview={inPreview(day, t) ? '' : undefined}
        onPointerMove={(e) => { if (e.pointerType !== 'touch') setHover({ day, t, x: e.clientX, y: e.clientY }); }}
        onClick={() => onSelect({ day, start: startOk(t) ? t : toHhmm(Math.max(toMin(plan.window_start), Math.min(toMin(t), toMin(plan.window_end) - plan.duration_min))) })}
        aria-label={`${dayLabel(day, plan.kind)} ${clockLabel(t)}: ${c.can} can make it${c.m ? `, ${c.m} of them if needed` : ''}${f ? ', works for everyone' : ''}`}
      >
        <span className={styles.heatNum}>{c.can > 0 ? c.can : ''}</span>
      </button>
    );
  };

  return (
    <div className={styles.gridBlock} ref={block}>
      <div className={styles.gridWrap} data-gridwrap>
        <div className={styles.gridTable} style={{ gridTemplateColumns: `var(--timeW) repeat(${days.length}, var(--colW))` }} onPointerLeave={() => setHover(null)}>
          <div className={styles.corner} />
          {days.map((d) => <div key={d} className={`${styles.colHead} ${hover?.day === d ? styles.hot : ''} ${preview?.day === d ? styles.previewHead : ''}`}><span>{dayLabel(d, plan.kind)}</span></div>)}
          {starts.map((t) => (
            <div key={t} style={{ display: 'contents' }}>
              <div className={`${styles.timeLbl} ${t.endsWith(':00') ? '' : styles.timeHalf} ${hover?.t === t ? styles.timeHot : ''} ${preview && inPreview(preview.day, t) ? styles.previewTime : ''}`}>{t.endsWith(':00') || hover?.t === t || (preview && inPreview(preview.day, t) && t === preview.start) ? clockLabel(t) : ''}</div>
              {days.map((d) => render(d, t))}
            </div>
          ))}
        </div>
      </div>
      {hover && (() => { const c = cell(hover.day, hover.t); const names = ifNeededNames(hover.day, hover.t); return (
        <div className={styles.hoverTip} style={{ left: hover.x + 14, top: hover.y + 16 }} aria-hidden="true">
          {dayLabel(hover.day, plan.kind)} · {clockLabel(hover.t)}
          <em>{c.can} can make it{fits(hover.day, hover.t) ? ' (everyone)' : ''}</em>
          {names.length > 0 && <em>If needed: {names.join(', ')}</em>}
        </div>
      ); })()}
      <Legend total={plan.people.length} />
    </div>
  );
}

function Legend({ total }: { total: number }) {
  return (
    <div className={styles.legend}>
      <span className={styles.legendItem}><span className={styles.legendBar} aria-hidden="true" /> {total <= 1 ? 'person' : `people (of ${total})`} who can</span>
      <span className={styles.legendItem}><span className={`${styles.legendBox} ${styles.legendStripe}`} aria-hidden="true" /> some only if needed</span>
      <span className={styles.legendItem}><span className={`${styles.legendBox} ${styles.legendAll}`} aria-hidden="true" /> everyone</span>
    </div>
  );
}

// Who is free for a meeting of the plan's length starting at day/start: a bar showing the split, then each group as a row of people with an icon.
export function WhoPanel({ plan, pick }: { plan: PlanView; pick: { day: string; start: string } }) {
  const t = evaluateStart(pick.day, pick.start, plan.duration_min, plan.people, plan.responses, plan.blocked);
  const end = toHhmm(toMin(pick.start) + plan.duration_min);
  const total = Math.max(1, plan.people.length);
  const groups = [
    { key: 'yes', label: 'Available', icon: <Check size={14} aria-hidden="true" />, list: t.available, tone: styles.gYes },
    { key: 'maybe', label: 'If needed', icon: <CircleHelp size={14} aria-hidden="true" />, list: t.ifNeeded, tone: styles.gMaybe },
    { key: 'no', label: 'Can’t', icon: <X size={14} aria-hidden="true" />, list: t.unavailable, tone: styles.gNo },
    { key: 'wait', label: 'No answer', icon: <Hourglass size={14} aria-hidden="true" />, list: t.noResponse, tone: styles.gWait },
  ];
  return (
    <div className={styles.who}>
      <strong className={styles.whoTitle}><CalendarClock size={16} aria-hidden="true" /> {dayLabel(pick.day, plan.kind)}, {clockLabel(pick.start)} to {clockLabel(end)}</strong>
      <div className={styles.whoBar} role="img" aria-label={groups.map((g) => `${g.list.length} ${g.label.toLowerCase()}`).join(', ')}>
        {groups.map((g) => g.list.length > 0 && <span key={g.key} className={g.tone} style={{ flexGrow: g.list.length / total }} title={`${g.label}: ${g.list.length}`}>{g.list.length}</span>)}
      </div>
      {groups.filter((g) => g.list.length > 0).map((g) => (
        <div key={g.key} className={`${styles.whoRow} ${g.tone}`}>
          <span className={styles.whoHead}>{g.icon} {g.label} <b>{g.list.length}</b></span>
          <span className={styles.whoPeople}>
            {g.list.map((p) => {
              const b = g.key === 'no' ? t.blocked.find((x) => x.person.id === p.id) : null;
              return <span key={p.id} className={styles.person}><i aria-hidden="true">{p.name[0]?.toUpperCase()}</i>{p.name}{b && <em title={`Booked: ${b.titles.join(', ')}`}><CalendarX size={11} aria-hidden="true" /> {b.titles.join(', ')}</em>}</span>;
            })}
          </span>
        </div>
      ))}
    </div>
  );
}

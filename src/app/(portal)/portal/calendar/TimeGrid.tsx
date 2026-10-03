'use client';

import { useEffect, useRef } from 'react';
import { StatusBadge, kindClass, timeOf, type Item } from './calendarParts';
import styles from './calendar.module.css';

// Week and day views laid out by the hour, like a paper planner: blocks are as tall as the item is long, items that overlap share the
// width, and a line marks the time right now. All times are Pacific.
const TZ = 'America/Los_Angeles';
const HOUR_PX = 52;
const parts = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
function pacific(iso: string) {
  const o: Record<string, string> = {};
  for (const p of parts.formatToParts(new Date(iso))) o[p.type] = p.value;
  return { day: `${o.year}-${o.month}-${o.day}`, min: Number(o.hour) * 60 + Number(o.minute) };
}

interface Block { item: Item; from: number; to: number; lane: number; lanes: number }
// Where an item sits within one day (minutes from midnight). A day in the middle of a multi-day event fills the whole day.
function layout(items: Item[], date: string): Block[] {
  const raw = items.map((item) => {
    const s = pacific(item.start); const e = item.end ? pacific(item.end) : null;
    const from = s.day === date ? s.min : 0;
    let to = e ? (e.day === date ? e.min : e.day > date ? 1440 : from + 60) : from + 60;
    if (to - from < 30) to = from + 30;
    return { item, from, to: Math.min(1440, to), lane: 0, lanes: 1 };
  }).sort((a, b) => a.from - b.from || a.to - b.to);
  // Group into clusters of overlapping items; inside a cluster each takes the first free lane and shares the width.
  let cluster: Block[] = []; let clusterEnd = -1;
  const flush = () => { const n = Math.max(1, ...cluster.map((b) => b.lane + 1)); for (const b of cluster) b.lanes = n; cluster = []; };
  for (const b of raw) {
    if (cluster.length && b.from >= clusterEnd) { flush(); clusterEnd = -1; }
    const taken = new Set(cluster.filter((c) => c.to > b.from).map((c) => c.lane));
    let lane = 0; while (taken.has(lane)) lane++;
    b.lane = lane; cluster.push(b); clusterEnd = Math.max(clusterEnd, b.to);
  }
  flush();
  return raw;
}

const hourLabel = (h: number) => (h === 0 || h === 24 ? '12 AM' : h === 12 ? 'Noon' : h < 12 ? `${h} AM` : `${h - 12} PM`);

export default function TimeGrid({ days, byDay, today, nowIso, dayName, onOpen }: {
  days: string[]; byDay: Map<string, Item[]>; today: string; nowIso: string; dayName: (d: string) => { name: string; num: number };
  onOpen: (item: Item, rect: DOMRect) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const blocks = new Map(days.map((d) => [d, layout(byDay.get(d) ?? [], d)]));
  const all = [...blocks.values()].flat();
  // The hours shown: 8 AM to 10 PM, widened to take in anything earlier or later.
  const startH = Math.max(0, Math.min(8, all.length ? Math.floor(Math.min(...all.map((b) => b.from)) / 60) : 8));
  const endH = Math.min(24, Math.max(22, all.length ? Math.ceil(Math.max(...all.map((b) => b.to)) / 60) : 22));
  const hours = Array.from({ length: endH - startH }, (_, i) => startH + i);
  const now = pacific(nowIso);
  const showNow = days.includes(today) && now.min >= startH * 60 && now.min <= endH * 60;

  // Start scrolled to the first thing of the day (or a little before now), so the page opens on something useful.
  useEffect(() => {
    const el = scroller.current; if (!el) return;
    const first = all.length ? Math.min(...all.map((b) => b.from)) : null;
    const target = days.includes(today) ? Math.min(now.min, first ?? now.min) : first ?? startH * 60;
    el.scrollTop = Math.max(0, ((target - startH * 60) / 60 - 0.5) * HOUR_PX);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days.join('|'), all.length]);

  return (
    <div className={styles.tg} style={{ ['--cols' as string]: days.length }}>
      <div className={styles.tgHead}>
        <span className={styles.tgCorner} />
        {days.map((d) => { const n = dayName(d); return (
          <span key={d} className={`${styles.tgDayHead} ${d === today ? styles.tgDayToday : ''}`}><span className={styles.weekName}>{n.name}</span><span className={styles.weekNum}>{n.num}</span></span>
        ); })}
      </div>
      <div className={styles.tgScroll} ref={scroller}>
        <div className={styles.tgBody} style={{ height: hours.length * HOUR_PX }}>
          <div className={styles.tgGutter}>
            {hours.map((h, i) => <span key={h} className={styles.tgHour} style={{ top: i * HOUR_PX, transform: i === 0 ? 'translateY(2px)' : undefined }}>{hourLabel(h)}</span>)}
          </div>
          {days.map((d) => (
            <div key={d} className={`${styles.tgCol} ${d === today ? styles.tgColToday : ''}`}>
              {hours.map((h, i) => <span key={h} className={styles.tgLine} style={{ top: i * HOUR_PX }} />)}
              {(blocks.get(d) ?? []).map((b) => {
                const top = ((b.from - startH * 60) / 60) * HOUR_PX; const height = Math.max(22, ((b.to - b.from) / 60) * HOUR_PX - 2);
                return (
                  <button
                    key={b.item.key} type="button"
                    className={`${styles.tgBlock} ${kindClass(b.item.kind)}`}
                    style={{ top, height, left: `calc(${(b.lane / b.lanes) * 100}% + 2px)`, width: `calc(${100 / b.lanes}% - 4px)` }}
                    onClick={(e) => onOpen(b.item, e.currentTarget.getBoundingClientRect())}
                    aria-label={`${b.item.title}, ${timeOf(b.item.start)}`}
                  >
                    <span className={styles.tgTitle}>{b.item.title}<StatusBadge status={b.item.status} compact /></span>
                    {height >= 40 && <span className={styles.tgTime}>{timeOf(b.item.start)}</span>}
                    {height >= 58 && b.item.location && <span className={styles.tgTime}>{b.item.location}</span>}
                  </button>
                );
              })}
              {showNow && d === today && <span className={styles.tgNow} style={{ top: ((now.min - startH * 60) / 60) * HOUR_PX }} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

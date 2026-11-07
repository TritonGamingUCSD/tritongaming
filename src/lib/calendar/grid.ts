import { addDaysKey, pacificDayKey } from '@/lib/core/timezone';
import type { CalItem, CalKind } from './types';

// The calendar's arithmetic: which days a view shows, which items fall on which day, how to step forward and back. All days are Pacific days (YYYY-MM-DD) and weeks start on Sunday. Pure.
export type CalView = 'month' | 'week' | 'agenda';
export const CAL_VIEWS: CalView[] = ['month', 'week', 'agenda'];

const utc = (day: string) => Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10));
export const dayOfWeek = (day: string) => new Date(utc(day)).getUTCDay();
export const startOfWeek = (day: string) => addDaysKey(day, -dayOfWeek(day));
export const startOfMonth = (day: string) => `${day.slice(0, 7)}-01`;
export const endOfMonth = (day: string) => {
  const d = new Date(Date.UTC(+day.slice(0, 4), +day.slice(5, 7), 0));
  return `${day.slice(0, 7)}-${String(d.getUTCDate()).padStart(2, '0')}`;
};
export const isDay = (s: string | null | undefined): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(utc(s));

/** The days a view shows around a date: a month is whole weeks (5 or 6 of them), a week is seven days, an agenda is the date's month. */
export function viewRange(view: CalView, day: string): { from: string; to: string } {
  if (view === 'week') {
    const from = startOfWeek(day);
    return { from, to: addDaysKey(from, 6) };
  }
  const from = view === 'month' ? startOfWeek(startOfMonth(day)) : startOfMonth(day);
  const to = view === 'month' ? addDaysKey(startOfWeek(endOfMonth(day)), 6) : endOfMonth(day);
  return { from, to };
}

/** Every day from one day to another, in order. */
export function daysIn(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to && out.length < 400; d = addDaysKey(d, 1)) out.push(d);
  return out;
}

/** The date a view moves to when you press back (-1) or forward (+1). */
export function stepDate(view: CalView, day: string, dir: -1 | 1): string {
  if (view === 'week') return addDaysKey(day, 7 * dir);
  const y = +day.slice(0, 4);
  const m = +day.slice(5, 7) - 1 + dir;
  const first = new Date(Date.UTC(y, m, 1));
  return `${first.getUTCFullYear()}-${String(first.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

/** The first and last Pacific day an item covers (an all-day item's end is its last day; a timed one ends on the day its end instant falls on, unless it ends at midnight). */
export function itemSpan(item: CalItem): { first: string; last: string } {
  if (item.allDay) return { first: item.start, last: item.end && item.end >= item.start ? item.end : item.start };
  const first = pacificDayKey(item.start);
  if (!item.end || item.end <= item.start) return { first, last: first };
  const endDay = pacificDayKey(new Date(Date.parse(item.end) - 1));
  return { first, last: endDay < first ? first : endDay };
}

/** Items by day for the days in view; a multi-day item is on each of its days. Within a day: all-day first, then by start time. */
export function groupByDay(items: CalItem[], from: string, to: string): Map<string, CalItem[]> {
  const map = new Map<string, CalItem[]>();
  for (const it of items) {
    const { first, last } = itemSpan(it);
    for (let d = first < from ? from : first; d <= last && d <= to; d = addDaysKey(d, 1)) {
      const list = map.get(d) ?? [];
      list.push(it);
      map.set(d, list);
    }
  }
  for (const list of map.values()) list.sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.localeCompare(b.start) || a.title.localeCompare(b.title));
  return map;
}

export const countByKind = (items: CalItem[]): Partial<Record<CalKind, number>> => {
  const out: Partial<Record<CalKind, number>> = {};
  for (const it of items) out[it.kind] = (out[it.kind] ?? 0) + 1;
  return out;
};

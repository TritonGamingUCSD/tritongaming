import { monthLabels } from '@/lib/events/monthBuckets';
import { PACIFIC_TZ, pacificDayKey } from '@/lib/core/timezone';

// The math behind the analytics charts, as plain functions of plain data (so it is tested without a database). Everything is read in Pacific time, the club's clock.

const WEEKDAY: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
const partsFmt = new Intl.DateTimeFormat('en-US', { timeZone: PACIFIC_TZ, weekday: 'short', hour: 'numeric', hour12: false });

/** How many times something happened in each weekday-and-hour slot: [hour, weekday (0 = Monday), count]. Only the hours in `hours` are kept. */
export function weekdayHourCounts(times: string[], hours: number[]): [number, number, number][] {
  const count = new Map<string, number>();
  for (const iso of times) {
    const p = partsFmt.formatToParts(new Date(iso));
    const wd = WEEKDAY[p.find((x) => x.type === 'weekday')?.value ?? ''];
    const hRaw = Number(p.find((x) => x.type === 'hour')?.value ?? NaN);
    const h = hRaw === 24 ? 0 : hRaw;
    if (wd === undefined || !hours.includes(h)) continue;
    const key = `${hours.indexOf(h)}:${wd}`;
    count.set(key, (count.get(key) ?? 0) + 1);
  }
  return [...count.entries()].map(([k, n]) => {
    const [hi, wd] = k.split(':').map(Number);
    return [hi, wd, n] as [number, number, number];
  });
}

/** How many times something happened on each day: [YYYY-MM-DD, count], oldest first. */
export function dailyCounts(times: string[]): [string, number][] {
  const m = new Map<string, number>();
  for (const iso of times) {
    const d = pacificDayKey(iso);
    m.set(d, (m.get(d) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

const monthKey = (iso: string) => pacificDayKey(iso).slice(0, 7);
const addMonths = (key: string, n: number) => {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};

/**
 * Retention cohorts. People are grouped by the month of their first check-in; each cell is the share of that group who checked in again `n` months later (month 0 is always 100%).
 * Only the last `maxCohorts` months are shown, and a cell for a month that has not happened yet is left out.
 */
export function retentionCohorts(
  rows: { user: string; at: string }[],
  now: Date,
  maxCohorts = 6,
  maxOffset = 5,
): { rows: string[]; cols: string[]; data: [number, number, number][]; sizes: number[] } {
  const monthsByUser = new Map<string, Set<string>>();
  for (const r of rows) {
    const set = monthsByUser.get(r.user) ?? new Set<string>();
    set.add(monthKey(r.at));
    monthsByUser.set(r.user, set);
  }
  const first = new Map<string, string>();
  for (const [u, set] of monthsByUser) first.set(u, [...set].sort()[0]);
  const nowKey = monthKey(now.toISOString());
  const cohortKeys = [...new Set(first.values())].sort().slice(-maxCohorts);
  const cols = Array.from({ length: maxOffset + 1 }, (_, i) => (i === 0 ? 'Month 0' : `+${i}`));
  const data: [number, number, number][] = [];
  const sizes: number[] = [];
  cohortKeys.forEach((ck, ri) => {
    const members = [...first.entries()].filter(([, f]) => f === ck).map(([u]) => u);
    sizes.push(members.length);
    for (let off = 0; off <= maxOffset; off++) {
      const target = addMonths(ck, off);
      if (target > nowKey) break;
      const came = members.filter((u) => monthsByUser.get(u)!.has(target)).length;
      data.push([off, ri, Math.round((came / members.length) * 100)]);
    }
  });
  return { rows: cohortKeys.map((k, i) => `${monthLabels(cohortKeys).get(k) ?? k} (${sizes[i]})`), cols, data, sizes };
}

/** How many people sit in each tier, given each person's lifetime points and the tiers' starting points (lowest first). */
export function tierBuckets(lifetime: number[], tiers: { name: string; min: number }[]): { name: string; value: number }[] {
  const sorted = [...tiers].sort((a, b) => a.min - b.min);
  const out = sorted.map((t) => ({ name: t.name, value: 0 }));
  for (const pts of lifetime) {
    let idx = 0;
    sorted.forEach((t, i) => {
      if (pts >= t.min) idx = i;
    });
    if (out.length) out[idx].value++;
  }
  return out;
}

/** For one event: how many of the people who came had never come to an earlier event (new) and how many had (returning). */
export function newVersusReturning(attendees: string[], earlierAttendees: Set<string>): { newcomers: number; returning: number } {
  const unique = [...new Set(attendees)];
  const returning = unique.filter((u) => earlierAttendees.has(u)).length;
  return { newcomers: unique.length - returning, returning };
}

/** Counts in equal time slices between two moments (check-ins arriving, sign-ups building up). Returns labels and counts, and the running total. */
export function sliceCounts(times: string[], from: number, to: number, slices: number): { starts: number[]; counts: number[]; total: number[] } {
  const width = (to - from) / slices;
  const counts = new Array<number>(slices).fill(0);
  for (const iso of times) {
    const ms = new Date(iso).getTime();
    const i = Math.min(slices - 1, Math.max(0, Math.floor((ms - from) / width)));
    counts[i]++;
  }
  const total: number[] = [];
  counts.reduce((sum, c, i) => (total[i] = sum + c), 0);
  return { starts: counts.map((_, i) => from + i * width), counts, total };
}

// ---- Time series at any level of detail -------------------------------------------------------------------------------------------------------------------
// The admin charts can be read by day, by week (Monday to Sunday) or by month, over the last 30 days, 90 days, year or everything. These turn a list of days with counts into the points of one chart,
// with every day in the range present (a quiet day is 0, not missing), so the line and the bars tell the truth about quiet stretches.
export type Gran = 'day' | 'week' | 'month';
export type Range = '30d' | '90d' | '1y' | 'all';
export type Daily = [string, number][]; // [Pacific day "YYYY-MM-DD", count]

const dayMs = 86_400_000;
const toTime = (day: string) => Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)));
const fromTime = (t: number) => new Date(t).toISOString().slice(0, 10);
const mondayOf = (day: string) => {
  const t = toTime(day);
  const wd = (new Date(t).getUTCDay() + 6) % 7; // Monday = 0
  return fromTime(t - wd * dayMs);
};
const dayName = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });

export function rangeStart(range: Range, today: string, first: string): string {
  if (range === 'all') return first;
  const back = range === '30d' ? 29 : range === '90d' ? 89 : 364;
  const start = fromTime(toTime(today) - back * dayMs);
  return start < first && range !== '30d' ? (first < start ? start : first) : start;
}

export function seriesByGran(daily: Daily, gran: Gran, from: string, to: string): { keys: string[]; labels: string[]; values: number[] } {
  const byDay = new Map(daily);
  const keys: string[] = [];
  const values: number[] = [];
  const idx = new Map<string, number>();
  for (let t = toTime(from); t <= toTime(to); t += dayMs) {
    const day = fromTime(t);
    const key = gran === 'day' ? day : gran === 'week' ? mondayOf(day) : day.slice(0, 7);
    if (!idx.has(key)) {
      idx.set(key, keys.length);
      keys.push(key);
      values.push(0);
    }
    values[idx.get(key) as number] += byDay.get(day) ?? 0;
  }
  let labels: string[];
  if (gran === 'month') {
    const names = monthLabels(keys);
    labels = keys.map((k) => names.get(k) ?? k);
  } else {
    labels = keys.map((k) => dayName.format(new Date(`${k}T12:00:00Z`)));
  }
  return { keys, labels, values };
}

/** Running total, starting from how many there already were before the first point. */
export function runningTotal(values: number[], before = 0): number[] {
  let sum = before;
  return values.map((v) => (sum += v));
}

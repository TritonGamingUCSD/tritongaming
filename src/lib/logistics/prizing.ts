import { ANY_SIZE } from '@/lib/logistics/prizes';

// The Prizing page's own logic (no database, no React): how the prize table is grouped, what a station still needs, and what goes in the "Fix these" strip.

export type GroupBy = 'station' | 'sponsor' | 'size' | 'type' | 'status' | 'none';
export const GROUPS: { id: GroupBy; label: string }[] = [
  { id: 'station', label: 'Station' }, { id: 'sponsor', label: 'Sponsor' }, { id: 'size', label: 'Size' }, { id: 'type', label: 'Type' }, { id: 'status', label: 'Status' }, { id: 'none', label: 'No Groups' },
];
export const isGroupBy = (v: unknown): v is GroupBy => GROUPS.some((g) => g.id === v);

export interface PrizeIn {
  id: string; name: string; sponsor_id: string | null; size: string | null; type: string | null; in_hand: boolean; price: number | null; quantity: number; allocated: number; left: number;
}
export interface LineIn { id: string; station_id: string; prize_id: string; quantity: number }
export interface StationIn { id: string; name: string; prize_only?: boolean; prize_request_id?: string | null; prize_target_qty?: number | null; prize_target_sizes?: Record<string, number> | null }

// How many of each prize this event holds (promised, minus what was already given out) and where.
export function eventHolds(lines: LineIn[], given: (line: LineIn) => number) {
  const out = new Map<string, { total: number; remaining: number; lines: LineIn[] }>();
  for (const l of lines) {
    const e = out.get(l.prize_id) ?? { total: 0, remaining: 0, lines: [] };
    e.total += l.quantity; e.remaining += l.quantity - Math.min(given(l), l.quantity); e.lines.push(l);
    out.set(l.prize_id, e);
  }
  return out;
}

// What a prize row is about, for the Status grouping: red things first.
export type Status = 'over' | 'not-here' | 'assigned' | 'free' | 'out';
export const STATUS_LABEL: Record<Status, string> = { over: 'Over-promised', 'not-here': 'Not here yet', assigned: 'Assigned to this event', free: 'Not assigned', out: 'Out of stock' };
export const STATUS_ORDER: Status[] = ['over', 'not-here', 'assigned', 'free', 'out'];
export function statusOf(p: Pick<PrizeIn, 'left' | 'quantity' | 'in_hand'>, assignedHere: number): Status {
  if (p.left < 0) return 'over';
  if (!p.in_hand && (assignedHere > 0 || p.quantity > 0)) return 'not-here';
  if (assignedHere > 0) return 'assigned';
  if (p.quantity <= 0) return 'out';
  return 'free';
}

export interface Group<T> { key: string; label: string; rows: T[] }
// Groups rows by one thing, keeping the order the keys are first met in unless an order is given. Rows with no value go under `empty`, last.
export function groupBy<T>(rows: T[], keyOf: (r: T) => string | null, empty: string, order?: string[]): Group<T>[] {
  const map = new Map<string, T[]>();
  for (const r of rows) { const k = keyOf(r) ?? ''; map.set(k, [...(map.get(k) ?? []), r]); }
  const keys = [...map.keys()];
  const rank = (k: string) => (k === '' ? 1e9 : order && order.includes(k) ? order.indexOf(k) : order ? 1e8 : 0);
  keys.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  return keys.map((k) => ({ key: k, label: k === '' ? empty : k, rows: map.get(k)! }));
}

export const money = (n: number | null | undefined) => (n === null || n === undefined ? '' : `$${n.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`);
export const valueOf = (rows: { quantity: number; price: number | null }[]) => Math.round(rows.reduce((n, r) => n + r.quantity * (r.price ?? 0), 0) * 100) / 100;

// ---- what a station asked for and has --------------------------------------------------------------------------------------------------------------------------------------------------
// A request names how many of each size (and a total); a count of "any size" is what the total has beyond the sizes named, and prizes beyond a size's own count (or with no size) go toward it.
export function haveBySize(lines: { quantity: number; size: string | null }[]) {
  return lines.reduce<Record<string, number>>((m, l) => (l.size ? { ...m, [l.size]: (m[l.size] ?? 0) + l.quantity } : m), {});
}
export function stationNeed(station: Pick<StationIn, 'prize_target_qty' | 'prize_target_sizes'>, lines: { quantity: number; size: string | null }[]): { need: Record<string, number>; asked: number; has: number } {
  const target = station.prize_target_sizes ?? {}, have = haveBySize(lines);
  const asked = station.prize_target_qty ?? 0, has = lines.reduce((n, l) => n + l.quantity, 0);
  const wantAny = Math.max(0, asked - Object.values(target).reduce((n, x) => n + x, 0));
  const gotAny = has - Object.entries(have).reduce((n, [z, x]) => n + Math.min(x, target[z] ?? 0), 0);
  const need: Record<string, number> = Object.fromEntries(Object.entries(target).map(([z, n]) => [z, Math.max(0, n - (have[z] ?? 0))]).filter(([, n]) => (n as number) > 0));
  if (wantAny - gotAny > 0) need[ANY_SIZE] = wantAny - gotAny;
  return { need, asked, has };
}
export const needText = (need: Record<string, number>, sizeOrder: string[]) =>
  [...sizeOrder, ANY_SIZE].filter((z) => need[z]).map((z) => `${need[z]} ${z === ANY_SIZE ? 'of any size' : z}`).join(', ');

// ---- the "Fix these" strip -------------------------------------------------------------------------------------------------------------------------------------------------------------
export interface Fix { sev: 'bad' | 'warn'; text: string; focus: { kind: 'prize' | 'station'; id: string } }
export function prizingFixes(o: {
  prizes: (PrizeIn & { assignedHere: number })[]; stations: (StationIn & { lines: number; short: Record<string, number> })[]; sizeOrder: string[];
}): Fix[] {
  const out: Fix[] = [];
  for (const p of o.prizes) if (p.left < 0) out.push({ sev: 'bad', text: `${p.name}: ${-p.left} more promised than there are`, focus: { kind: 'prize', id: p.id } });
  for (const s of o.stations) {
    const short = needText(s.short, o.sizeOrder);
    if (short) out.push({ sev: 'warn', text: `${s.name} still needs ${short}`, focus: { kind: 'station', id: s.id } });
    else if (s.lines === 0) out.push({ sev: 'warn', text: `${s.name} has no prizes yet`, focus: { kind: 'station', id: s.id } });
  }
  const notHere = o.prizes.filter((p) => !p.in_hand && p.assignedHere > 0);
  if (notHere.length) out.push({ sev: 'warn', text: `${notHere.length} ${notHere.length === 1 ? 'prize' : 'prizes'} in this event ${notHere.length === 1 ? 'is' : 'are'} not here yet (${notHere.slice(0, 3).map((p) => p.name).join(', ')}${notHere.length > 3 ? '…' : ''})`, focus: { kind: 'prize', id: notHere[0].id } });
  return out;
}

import { ANY_SIZE, isLoose, type StockLevel } from '@/lib/logistics/prizes';
import { slugify } from '@/lib/core/slug';

// The Prizing page's own logic (no database, no React): how the prize table is grouped, what a station still needs, and what goes in the "Fix these" strip.

// An event is grouped by its stations by default (or any of the others); the stock (no event) by one of the others.
export type GroupBy = 'station' | 'sponsor' | 'source' | 'size' | 'type' | 'status';
export const GROUPS: { id: GroupBy; label: string }[] = [
  { id: 'station', label: 'Station' },
  { id: 'sponsor', label: 'Sponsor' },
  { id: 'source', label: 'Source' },
  { id: 'size', label: 'Size' },
  { id: 'type', label: 'Type' },
  { id: 'status', label: 'Status' },
];
export const isGroupBy = (v: unknown): v is GroupBy => GROUPS.some((g) => g.id === v);

export interface PrizeIn {
  id: string;
  name: string;
  sponsor_id: string | null;
  size: string | null;
  type: string | null;
  in_hand: boolean;
  price: number | null;
  quantity: number;
  allocated: number;
  left: number;
  stock_level?: StockLevel;
}
export interface LineIn {
  id: string;
  station_id: string;
  prize_id: string;
  quantity: number;
}
export interface StationIn {
  id: string;
  name: string;
  prize_only?: boolean;
  prize_request_id?: string | null;
  prize_target_qty?: number | null;
  prize_target_sizes?: Record<string, number> | null;
}

// How many of each prize this event holds (promised, minus what was given out, minus what came back to storage: `held` in lineNumbers) and where. `released` is a line's given out plus back in storage.
export function eventHolds(lines: LineIn[], released: (line: LineIn) => number) {
  const out = new Map<string, { total: number; remaining: number; lines: LineIn[] }>();
  for (const l of lines) {
    const e = out.get(l.prize_id) ?? { total: 0, remaining: 0, lines: [] };
    e.total += l.quantity;
    e.remaining += l.quantity - Math.min(released(l), l.quantity);
    e.lines.push(l);
    out.set(l.prize_id, e);
  }
  return out;
}

// What a prize row is about, for the Status grouping: red things first.
export type Status = 'over' | 'not-here' | 'assigned' | 'free' | 'out';
export const STATUS_LABEL: Record<Status, string> = {
  over: 'Over-promised',
  'not-here': 'Not here yet',
  assigned: 'Assigned to this event',
  free: 'Not assigned',
  out: 'Out of stock',
};
// The same states for the stock (no event picked): "assigned" means planned for some event, "free" means not planned yet.
export const STOCK_STATUS_LABEL: Record<Status, string> = {
  over: 'Over-promised',
  'not-here': 'Not here yet',
  assigned: 'Planned for events',
  free: 'Not planned yet',
  out: 'Out of stock',
};
export const STATUS_ORDER: Status[] = ['over', 'not-here', 'assigned', 'free', 'out'];
export function statusOf(p: Pick<PrizeIn, 'left' | 'quantity' | 'in_hand'> & { size?: string | null; stock_level?: StockLevel }, assignedHere: number): Status {
  if (isLoose(p)) return p.stock_level === 'out' ? 'out' : assignedHere > 0 ? 'assigned' : 'free';
  if (p.left < 0) return 'over';
  if (!p.in_hand && (assignedHere > 0 || p.quantity > 0)) return 'not-here';
  if (assignedHere > 0) return 'assigned';
  if (p.quantity <= 0) return 'out';
  return 'free';
}

export interface Group<T> {
  key: string;
  label: string;
  rows: T[];
}
// Groups rows by one thing, keeping the order the keys are first met in unless an order is given. Rows with no value go under `empty`, last.
export function groupBy<T>(rows: T[], keyOf: (r: T) => string | null, empty: string, order?: string[]): Group<T>[] {
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const k = keyOf(r) ?? '';
    map.set(k, [...(map.get(k) ?? []), r]);
  }
  const keys = [...map.keys()];
  const rank = (k: string) => (k === '' ? 1e9 : order && order.includes(k) ? order.indexOf(k) : order ? 1e8 : 0);
  keys.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  return keys.map((k) => ({ key: k, label: k === '' ? empty : k, rows: map.get(k)! }));
}

// Where a prize is from, in words: the sponsor (or the club) and the event it was received for. Used wherever a prize is shown.
// The event a prize was received for is shown by its address name (the slug, like division-showcase): the linked event's own slug while it exists, else the name made into one.
export const eventSlugOf = (p: { from_event?: string | null; from_plan_id?: string | null }, slugByPlan: Map<string, string>): string | null =>
  p.from_plan_id && slugByPlan.get(p.from_plan_id) ? slugByPlan.get(p.from_plan_id)! : p.from_event ? slugify(p.from_event) : null;
export const fromOf = (p: { from_event?: string | null; from_plan_id?: string | null }, sponsor: string | null, slugByPlan: Map<string, string> = new Map()) =>
  [sponsor ?? 'Club', eventSlugOf(p, slugByPlan)].filter(Boolean).join(' · ');

export const money = (n: number | null | undefined) =>
  n === null || n === undefined ? '' : `$${n.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`;
export const valueOf = (rows: { quantity: number; price: number | null }[]) => Math.round(rows.reduce((n, r) => n + r.quantity * (r.price ?? 0), 0) * 100) / 100;

// ---- what a station asked for and has --------------------------------------------------------------------------------------------------------------------------------------------------
// A request names how many of each size (and a total); a count of "any size" is what the total has beyond the sizes named, and prizes beyond a size's own count (or with no size) go toward it.
export function haveBySize(lines: { quantity: number; size: string | null }[]) {
  return lines.reduce<Record<string, number>>((m, l) => (l.size ? { ...m, [l.size]: (m[l.size] ?? 0) + l.quantity } : m), {});
}
export function stationNeed(
  station: Pick<StationIn, 'prize_target_qty' | 'prize_target_sizes'>,
  rawLines: { quantity: number; size: string | null }[],
): { need: Record<string, number>; asked: number; has: number } {
  const target = station.prize_target_sizes ?? {};
  // Free prizes are loose: a station that has any of them has all it asked for of that size (the count on its line means nothing).
  const freeKey = Object.keys(target).find((z) => isLoose({ size: z }));
  const loose = rawLines.filter((l) => isLoose(l));
  const lines =
    freeKey && loose.length
      ? rawLines.map((l) => (l === loose[0] ? { ...l, quantity: Math.max(l.quantity, (target[freeKey] ?? 0) - loose.slice(1).reduce((n, x) => n + x.quantity, 0)) } : l))
      : rawLines;
  const have = haveBySize(lines);
  const asked = station.prize_target_qty ?? 0,
    has = lines.reduce((n, l) => n + l.quantity, 0);
  const wantAny = Math.max(0, asked - Object.values(target).reduce((n, x) => n + x, 0));
  const gotAny = has - Object.entries(have).reduce((n, [z, x]) => n + Math.min(x, target[z] ?? 0), 0);
  const need: Record<string, number> = Object.fromEntries(
    Object.entries(target)
      .map(([z, n]) => [z, Math.max(0, n - (have[z] ?? 0))])
      .filter(([, n]) => (n as number) > 0),
  );
  if (wantAny - gotAny > 0) need[ANY_SIZE] = wantAny - gotAny;
  return { need, asked, has };
}
export const needText = (need: Record<string, number>, sizeOrder: string[]) =>
  [...sizeOrder, ANY_SIZE]
    .filter((z) => need[z])
    .map((z) => `${need[z]} ${z === ANY_SIZE ? 'of any size' : z}`)
    .join(', ');

// ---- the "Fix these" strip -------------------------------------------------------------------------------------------------------------------------------------------------------------
export interface Fix {
  sev: 'bad' | 'warn';
  text: string;
  focus: { kind: 'prize' | 'station'; id: string };
}
export function prizingFixes(o: {
  prizes: (PrizeIn & { assignedHere: number })[];
  stations: (StationIn & { lines: number; short: Record<string, number> })[];
  sizeOrder: string[];
}): Fix[] {
  const out: Fix[] = [];
  for (const p of o.prizes) if (p.left < 0) out.push({ sev: 'bad', text: `${p.name}: ${-p.left} more promised than there are`, focus: { kind: 'prize', id: p.id } });
  for (const s of o.stations) {
    const short = needText(s.short, o.sizeOrder);
    if (short) out.push({ sev: 'warn', text: `${s.name} still needs ${short}`, focus: { kind: 'station', id: s.id } });
    else if (s.lines === 0) out.push({ sev: 'warn', text: `${s.name} has no prizes yet`, focus: { kind: 'station', id: s.id } });
  }
  const notHere = o.prizes.filter((p) => !p.in_hand && p.assignedHere > 0);
  if (notHere.length)
    out.push({
      sev: 'warn',
      text: `${notHere.length} ${notHere.length === 1 ? 'prize' : 'prizes'} in this event ${notHere.length === 1 ? 'is' : 'are'} not here yet (${notHere
        .slice(0, 3)
        .map((p) => p.name)
        .join(', ')}${notHere.length > 3 ? '…' : ''})`,
      focus: { kind: 'prize', id: notHere[0].id },
    });
  return out;
}

// A later counter implies the earlier ones, like a device ticked at a later step: if 3 were given out, at least 3 were sorted and picked up. `steps` are in order; a "back to storage" step (`leftover`) is only about
// what was NOT handed out, so it neither implies the steps before it nor is implied by the ones after. The result is for showing and totalling only; the saved counts are not changed.
export function impliedCount(steps: { id: string; leftover: boolean }[], real: (stepId: string) => number, stepId: string): number {
  const i = steps.findIndex((s) => s.id === stepId);
  if (i < 0) return 0;
  const own = real(stepId);
  if (steps[i].leftover) return own;
  return steps
    .slice(i + 1)
    .filter((s) => !s.leftover)
    .reduce((m, s) => Math.max(m, real(s.id)), own);
}

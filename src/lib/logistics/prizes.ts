import { LIMITS } from '@/lib/logistics/constants';

// Prizes: the inventory (club stock and sponsor gifts), what each station of an event gets, and how far each prize line is through the event-day steps. Pure logic (no database).

// Loose prizes (free small merch: stickers, keychains; the sizes marked "Counted Loosely") are counted loosely: a station either has them or not, and the stock is a level (plenty / some / low / out) instead of a number. They are never over-promised and
// closing an event never takes them out of stock.
export const LEVELS = ['plenty', 'some', 'low', 'out'] as const;
export type StockLevel = (typeof LEVELS)[number];
export const LEVEL_LABEL: Record<StockLevel, string> = { plenty: 'Plenty', some: 'Some', low: 'Low', out: 'Out' };
// Which sizes are loose is a switch on the size in the list ("Counted Loosely"). The names are kept here once the lists are read, by the page and by the routes, so `isLoose` is a plain question of a prize.
let looseSizes = new Set<string>();
export const setLooseSizes = (names: string[]) => { looseSizes = new Set(names.map((n) => n.trim().toLowerCase())); };
export const isLoose = (p: { size?: string | null }) => looseSizes.has((p.size ?? '').trim().toLowerCase());
export const LOOSE_LEFT = 99999;   // what "left" reads for a loose prize that is not out, so nothing that picks prizes by what is left skips it

export interface Prize {
  id: string; name: string; sponsor_id: string | null; size: string | null; type: string | null; in_hand: boolean; price: number | null; quantity: number; quantity_is_estimate: boolean; stock_level: StockLevel;
  bin: string | null; source: string | null; from_event: string | null; from_plan_id: string | null; expires_on: string | null; notes: string | null;
}
// `quantity` is how many are on hand. `allocated` is what open events still hold for their stations (promised and not yet given out); a closed event holds nothing, so what it did not use is free
// again. Left is what is free to promise and can go below zero: that is an over-allocation.
export interface PrizeTotals { allocated: number }
export const prizeLeft = (p: Pick<Prize, 'quantity'> & { size?: string | null; stock_level?: string | null }, t: PrizeTotals) => (isLoose(p) ? (p.stock_level === 'out' ? 0 : LOOSE_LEFT) : p.quantity - t.allocated);

// A prize step is a count per line. `gives` marks the step that hands a prize out (it uses stock up); `leftover` marks a step that is only about what was NOT handed out ("back to storage").
export interface PrizeStepDef { id: string; name: string; sort: number; gives: boolean; leftover: boolean }

// The most a step can reach for a line: all of them, or only the ones not given out for a leftover step.
export const stepCeiling = (step: Pick<PrizeStepDef, 'leftover'>, line: { quantity: number }, givenOut: number) => (step.leftover ? Math.max(0, line.quantity - givenOut) : line.quantity);

export interface PrizePatch {
  name?: string; sponsor_id?: string | null; size?: string | null; type?: string | null; in_hand?: boolean; price?: number | null; quantity?: number; quantity_is_estimate?: boolean; stock_level?: StockLevel;
  bin?: string | null; source?: string | null; from_event?: string | null; from_plan_id?: string | null; expires_on?: string | null; notes?: string | null;
}
const text = (v: unknown, max: number) => { const s = String(v ?? '').trim().replace(/\s+/g, ' ').slice(0, max); return s || null; };
const UUID = /^[0-9a-f-]{36}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// Reads what the browser sent for a prize. With `partial` only the fields that were sent are returned (for an edit). Returns an error in words when something can't be used.
export function cleanPrize(b: Record<string, unknown>, partial: boolean): { value: PrizePatch } | { error: string } {
  const out: PrizePatch = {};
  const has = (k: string) => !partial || k in b;
  if (has('name')) { const n = text(b.name, 160); if (!n) return { error: 'Give the prize a name.' }; out.name = n; }
  if (has('sponsor_id')) out.sponsor_id = typeof b.sponsor_id === 'string' && UUID.test(b.sponsor_id) ? b.sponsor_id : null;
  if (has('size')) out.size = text(b.size, LIMITS.option);
  if (has('type')) out.type = text(b.type, LIMITS.option);
  if (has('in_hand')) out.in_hand = partial ? b.in_hand === true : b.in_hand !== false;   // a new prize is here unless it says it is not
  if (has('price')) {
    if (b.price === null || b.price === '' || b.price === undefined) out.price = null;
    else { const n = Number(b.price); if (!Number.isFinite(n) || n < 0 || n > 1_000_000) return { error: 'The price has to be a number, like 25 or 24.99.' }; out.price = Math.round(n * 100) / 100; }
  }
  if (has('quantity')) { const n = Math.round(Number(b.quantity ?? 0)); if (!Number.isFinite(n) || n < 0 || n > LIMITS.qtyMax) return { error: 'How many there are has to be a whole number.' }; out.quantity = n; }
  if (has('quantity_is_estimate')) out.quantity_is_estimate = b.quantity_is_estimate === true;
  if (has('stock_level')) out.stock_level = (LEVELS as readonly string[]).includes(String(b.stock_level)) ? (b.stock_level as StockLevel) : 'plenty';
  if (has('bin')) out.bin = text(b.bin, 120);
  if (has('source')) out.source = text(b.source, 200);
  if (has('from_event')) out.from_event = text(b.from_event, 120);
  if (has('from_plan_id')) out.from_plan_id = typeof b.from_plan_id === 'string' && UUID.test(b.from_plan_id) ? b.from_plan_id : null;
  if (has('expires_on')) { if (b.expires_on && !DATE.test(String(b.expires_on))) return { error: 'Pick the expiry date again.' }; out.expires_on = b.expires_on ? String(b.expires_on) : null; }
  if (has('notes')) out.notes = text(b.notes, LIMITS.notes);
  return { value: out };
}

export interface PrizeLineInfo { id: string; pool_id: string; prize_id: string; quantity: number }
// What to look at for the prizes of a plan: a prize promised more than there is, and a prize line with nothing set aside yet. `left` is per prize (see prizeLeft).
export interface PrizeProblem { sev: 'bad' | 'warn'; pool_id: string | null; line_id?: string; text: string }
export function prizeProblems(lines: (PrizeLineInfo & { name: string })[], left: Map<string, number>, pools: { id: string; name: string }[]): PrizeProblem[] {
  const out: PrizeProblem[] = [];
  const seen = new Set<string>();
  for (const l of lines) {
    const n = left.get(l.prize_id);
    if (n !== undefined && n < 0 && !seen.has(l.prize_id)) { seen.add(l.prize_id); out.push({ sev: 'bad', pool_id: l.pool_id, line_id: l.id, text: `${l.name}: ${-n} more promised than there are` }); }
  }
  for (const p of pools) if (!lines.some((l) => l.pool_id === p.id)) out.push({ sev: 'warn', pool_id: p.id, text: `${p.name} has no prizes yet` });
  return out;
}

// Suggest prizes for what a pool still needs: `need` is how many more it wants of each size; the key ANY_SIZE is a count that may be filled from any size (done last, from what the sizes left). For every size the picks are spread over the prizes of that size that are in stock, the one with the most
// left first (sponsor prizes first when two have as many left, since they can't be returned), and a prize is never used more than is left. Returns how many of each prize to add and, per size, how
// many could not be found.
export const ANY_SIZE = '';
export interface Candidate { id: string; size: string | null; left: number; sponsor: boolean }
export function suggestPrizes(candidates: Candidate[], need: Record<string, number>): { picks: Map<string, number>; short: Record<string, number> } {
  const left = new Map(candidates.filter((c) => c.left > 0).map((c) => [c.id, c.left]));
  const picks = new Map<string, number>();
  const short: Record<string, number> = {};
  for (const [size, n] of Object.entries(need).sort((a, b) => (a[0] === ANY_SIZE ? 1 : 0) - (b[0] === ANY_SIZE ? 1 : 0))) {
    const pool = size === ANY_SIZE ? candidates : candidates.filter((c) => c.size === size);
    for (let i = 0; i < n; i++) {
      let best: Candidate | null = null, bestLeft = 0;
      for (const c of pool) {
        const l = left.get(c.id) ?? 0;
        if (l > bestLeft || (l === bestLeft && best && l > 0 && c.sponsor && !best.sponsor)) { best = c; bestLeft = l; }
      }
      if (!best) { short[size] = (short[size] ?? 0) + (n - i); break; }
      left.set(best.id, bestLeft - 1);
      picks.set(best.id, (picks.get(best.id) ?? 0) + 1);
    }
  }
  return { picks, short };
}

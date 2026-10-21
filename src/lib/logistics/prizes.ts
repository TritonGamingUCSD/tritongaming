import { LIMITS } from '@/lib/logistics/constants';

// Prizes: the inventory (club stock and sponsor gifts), what each pool of an event gets, and how far each prize line is through the event-day steps. Pure logic (no database).

export interface Prize {
  id: string; name: string; sponsor_id: string | null; size: string | null; price: number | null; quantity: number; quantity_is_estimate: boolean;
  shelf: string | null; tier: string | null; place_note: string | null; plan_id: string | null; expires_on: string | null; notes: string | null;
}
// What the lists add up to for one prize: `allocated` is what open plans still hold for their pools, `given` what has been given out at any event. Left can go below zero: that is an over-allocation.
export interface PrizeTotals { allocated: number; given: number }
export const prizeLeft = (p: Pick<Prize, 'quantity'>, t: PrizeTotals) => p.quantity - t.given - t.allocated;

// A prize step is a count per line. `gives` marks the step that hands a prize out (it uses stock up); `leftover` marks a step that is only about what was NOT handed out ("back to storage").
export interface PrizeStepDef { id: string; name: string; sort: number; gives: boolean; leftover: boolean }

// The most a step can reach for a line: all of them, or only the ones not given out for a leftover step.
export const stepCeiling = (step: Pick<PrizeStepDef, 'leftover'>, line: { quantity: number }, givenOut: number) => (step.leftover ? Math.max(0, line.quantity - givenOut) : line.quantity);

export interface PrizePatch {
  name?: string; sponsor_id?: string | null; size?: string | null; price?: number | null; quantity?: number; quantity_is_estimate?: boolean;
  shelf?: string | null; tier?: string | null; place_note?: string | null; plan_id?: string | null; expires_on?: string | null; notes?: string | null;
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
  if (has('price')) {
    if (b.price === null || b.price === '' || b.price === undefined) out.price = null;
    else { const n = Number(b.price); if (!Number.isFinite(n) || n < 0 || n > 1_000_000) return { error: 'The price has to be a number, like 25 or 24.99.' }; out.price = Math.round(n * 100) / 100; }
  }
  if (has('quantity')) { const n = Math.round(Number(b.quantity ?? 0)); if (!Number.isFinite(n) || n < 0 || n > LIMITS.qtyMax) return { error: 'How many there are has to be a whole number.' }; out.quantity = n; }
  if (has('quantity_is_estimate')) out.quantity_is_estimate = b.quantity_is_estimate === true;
  if (has('shelf')) out.shelf = text(b.shelf, LIMITS.option);
  if (has('tier')) out.tier = text(b.tier, LIMITS.option);
  if (has('place_note')) out.place_note = text(b.place_note, LIMITS.note);
  if (has('plan_id')) out.plan_id = typeof b.plan_id === 'string' && UUID.test(b.plan_id) ? b.plan_id : null;
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

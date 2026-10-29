import { CONDITIONS, LIMITS, conditionLabel, type Condition } from '@/lib/logistics/constants';

// One piece of equipment, as stored (lib/logistics tables: logistics_devices).
export interface KitLine {
  item: string;
  qty: number;
  missing: boolean;
}
export interface Device {
  id: string;
  tag: string | null;
  name: string | null;
  type: string;
  shelf: string | null;
  tier: string | null;
  place_note: string | null;
  condition: Condition;
  ports: string[];
  login: string | null;
  games: string[];
  kit: KitLine[];
  quantity: number | null;
  quantity_is_estimate: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// "TECM 1", "tecm1" and "TECM1" are the same device: the ID is compared with spaces and capitals ignored. This is what the typed ID on event day is matched with.
export const tagKey = (tag: string | null | undefined): string =>
  String(tag ?? '')
    .toLowerCase()
    .replace(/\s+/g, '');

const text = (v: unknown, max: number): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().slice(0, max);
  return s ? s : null;
};
export function cleanList(v: unknown, max = LIMITS.listItems): string[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of v) {
    const s = String(x ?? '')
      .trim()
      .slice(0, LIMITS.option);
    if (!s || seen.has(s.toLowerCase())) continue;
    seen.add(s.toLowerCase());
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
}
export function cleanKit(v: unknown): KitLine[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: KitLine[] = [];
  for (const x of v) {
    const o = (x ?? {}) as Record<string, unknown>;
    const item = String(o.item ?? '')
      .trim()
      .slice(0, LIMITS.option);
    if (!item || seen.has(item.toLowerCase())) continue;
    seen.add(item.toLowerCase());
    const qty = Math.round(Number(o.qty));
    out.push({ item, qty: Number.isFinite(qty) && qty >= 1 ? Math.min(qty, 999) : 1, missing: o.missing === true });
    if (out.length >= LIMITS.kitLines) break;
  }
  return out;
}

export type DevicePatch = Partial<
  Pick<Device, 'tag' | 'name' | 'type' | 'shelf' | 'tier' | 'place_note' | 'condition' | 'ports' | 'login' | 'games' | 'kit' | 'quantity' | 'quantity_is_estimate' | 'notes'>
>;

// Reads what the browser sent. Only the fields that were sent come back (so an edit changes just those); anything unknown is dropped. `error` is a plain sentence for the person.
export function cleanDevice(raw: unknown): { value: DevicePatch; error?: string } {
  const b = (raw ?? {}) as Record<string, unknown>;
  const v: DevicePatch = {};
  const has = (k: string) => Object.prototype.hasOwnProperty.call(b, k);
  if (has('tag')) v.tag = text(b.tag, LIMITS.tag);
  if (has('name')) v.name = text(b.name, LIMITS.name);
  if (has('type')) {
    const t = text(b.type, LIMITS.option);
    if (!t) return { value: v, error: 'Pick what kind of device it is.' };
    v.type = t;
  }
  if (has('shelf')) v.shelf = text(b.shelf, LIMITS.option);
  if (has('tier')) v.tier = text(b.tier, LIMITS.option);
  if (has('place_note')) v.place_note = text(b.place_note, LIMITS.note);
  if (has('condition')) {
    if (!CONDITIONS.some((c) => c.id === b.condition)) return { value: v, error: 'Pick a condition from the list.' };
    v.condition = b.condition as Condition;
  }
  if (has('ports')) v.ports = cleanList(b.ports);
  if (has('login')) v.login = text(b.login, LIMITS.login);
  if (has('games')) v.games = cleanList(b.games, 60);
  if (has('kit')) v.kit = cleanKit(b.kit);
  if (has('quantity')) {
    if (b.quantity === null || b.quantity === '' || b.quantity === undefined) v.quantity = null;
    else {
      const q = Math.round(Number(b.quantity));
      if (!Number.isFinite(q) || q < 0 || q > LIMITS.qtyMax) return { value: v, error: 'The quantity must be a whole number.' };
      v.quantity = q;
    }
  }
  if (has('quantity_is_estimate')) v.quantity_is_estimate = b.quantity_is_estimate !== false;
  if (has('notes')) v.notes = text(b.notes, LIMITS.notes);
  return { value: v };
}

const placeOf = (d: Pick<Device, 'shelf' | 'tier'>) => [d.shelf, d.tier].filter(Boolean).join(' · ') || 'no place';

// The history lines for a change: what a person would want to read later ("Condition: Working → Dead", "Moved: Shelf A · T1 → Shelf C · T0", "Marked missing: HDMI cable").
export function describeChange(before: Device, after: Device): { kind: string; summary: string }[] {
  const out: { kind: string; summary: string }[] = [];
  if (before.condition !== after.condition) out.push({ kind: 'condition', summary: `Condition: ${conditionLabel(before.condition)} → ${conditionLabel(after.condition)}` });
  if (before.shelf !== after.shelf || before.tier !== after.tier) out.push({ kind: 'moved', summary: `Moved: ${placeOf(before)} → ${placeOf(after)}` });
  if ((before.tag ?? '') !== (after.tag ?? '')) out.push({ kind: 'tag', summary: `ID: ${before.tag ?? 'none'} → ${after.tag ?? 'none'}` });
  if (before.type !== after.type) out.push({ kind: 'type', summary: `Type: ${before.type} → ${after.type}` });
  const was = new Map(before.kit.map((k) => [k.item.toLowerCase(), k]));
  const now = new Map(after.kit.map((k) => [k.item.toLowerCase(), k]));
  for (const [key, k] of now) {
    const old = was.get(key);
    if (!old) out.push({ kind: 'kit', summary: `Kit: added ${k.item}${k.qty > 1 ? ` ×${k.qty}` : ''}` });
    else if (!old.missing && k.missing) out.push({ kind: 'kit', summary: `Marked missing: ${k.item}` });
    else if (old.missing && !k.missing) out.push({ kind: 'kit', summary: `Found again: ${k.item}` });
  }
  for (const [key, k] of was) if (!now.has(key)) out.push({ kind: 'kit', summary: `Kit: removed ${k.item}` });
  if ((before.notes ?? '') !== (after.notes ?? '')) out.push({ kind: 'note', summary: after.notes ? 'Notes updated' : 'Notes cleared' });
  if (before.quantity !== after.quantity)
    out.push({ kind: 'quantity', summary: `Quantity: ${before.quantity ?? 'unknown'} → ${after.quantity ?? 'unknown'}${after.quantity_is_estimate ? ' (estimate)' : ''}` });
  return out;
}

// "about 30" or "30". Counted rows show an estimate with a leading "about".
export const quantityText = (d: Pick<Device, 'quantity' | 'quantity_is_estimate'>): string =>
  d.quantity === null ? 'Unknown' : `${d.quantity_is_estimate ? 'about ' : ''}${d.quantity}`;

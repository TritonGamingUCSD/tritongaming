import { UNUSABLE, type ItemKind } from '@/lib/logistics/constants';
import type { Device } from '@/lib/logistics/devices';

// Event plans: which devices go to an event, the steps each goes through, and how devices are chosen. Pure logic (no database), so it can be tested on its own.

export type Applies = 'all' | 'club' | 'borrowed';
export interface StepDef { id: string; name: string; sort: number; applies: Applies; kit: boolean }   // kit: the device's parts are reviewed (present / missing) at this step
export const APPLIES_LABELS: Record<Applies, string> = { all: 'Every device', club: 'Club devices only', borrowed: 'Sponsor and loaner devices only' };

// "Back to Storage" is for the club's own devices; "Returned to owner" for borrowed ones (a sponsor's, an officer's loan). Everything else applies to every device.
export const stepAppliesTo = (s: Pick<StepDef, 'applies'>, kind: ItemKind): boolean => s.applies === 'all' || (s.applies === 'club' ? kind === 'club' : kind !== 'club');
export const stepsFor = (steps: StepDef[], kind: ItemKind): StepDef[] => steps.filter((s) => stepAppliesTo(s, kind)).sort((a, b) => a.sort - b.sort);

// The plan's name as it is written in its address: lower case words joined with hyphens.
// Words that are the other pages of Logistics, so an event cannot take one as its address name.
export const RESERVED_SLUGS = ['events', 'plans', 'inventory', 'equipment', 'prizes', 'tools', 'sponsors'];
export const planSlug = (name: string): string => name.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '') || 'plan';

export const natural = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
const conditionRank = (c: Device['condition']) => (c === 'working' || c === 'brand_new' ? 0 : c === 'not_tested' ? 1 : 9);
export const isUsable = (d: Pick<Device, 'condition'>) => !UNUSABLE.includes(d.condition);
const hasGames = (d: Device, games: string[]) => games.every((g) => d.games.some((x) => x.toLowerCase() === g.toLowerCase()));

export interface PickResult { picked: Device[]; short: number; notTested: number; missingGames: number }

// Chooses `count` devices of a type from the inventory (which is the club's own), never one that can't be handed out, never one already `taken` (in another plan that overlaps, or already chosen).
// Order: devices that have the requested games installed first, then Working / Brand New before Not Tested, then by ID. `short` is how many could not be found.
export function pickDevices(all: Device[], req: { type: string; count: number; games?: string[]; taken: Set<string> }): PickResult {
  const games = (req.games ?? []).filter(Boolean);
  const pool = all
    .filter((d) => d.type.toLowerCase() === req.type.toLowerCase() && isUsable(d) && !req.taken.has(d.id))
    .sort((a, b) => (games.length ? Number(!hasGames(a, games)) - Number(!hasGames(b, games)) : 0) || conditionRank(a.condition) - conditionRank(b.condition) || natural(a.tag ?? a.type, b.tag ?? b.type));
  const picked = pool.slice(0, Math.max(0, req.count));
  return { picked, short: Math.max(0, req.count - picked.length), notTested: picked.filter((d) => d.condition === 'not_tested').length, missingGames: games.length ? picked.filter((d) => !hasGames(d, games)).length : 0 };
}

export interface BundleItem { type: string; qty: number }
// One row of a station made from a bundle: the type asked for, the games it needs, and the device chosen (null when none was available, or for counted things like a mousepad).
export interface Cell { type: string; games: string[]; device: Device | null }
export interface BundlePick { stations: Cell[][]; short: { type: string; missing: number }[]; notTested: number; missingGames: number }

// "PC Station ×5": five stations, each with a row for every item of the bundle (a quantity of 2 is two rows). Devices are chosen for the rows in order, so station 1 gets the first of
// each type and a shortage leaves the LAST stations with empty rows. The requested games count for the first item (the computer). Counted types (a mousepad) never get a device:
// their rows stay as type-only rows, one per unit, and are not a shortage.
export function pickBundle(all: Device[], items: BundleItem[], stations: number, games: string[], taken: Set<string>, counted: Set<string> = new Set()): BundlePick {
  const used = new Set(taken);
  const out: BundlePick = { stations: Array.from({ length: stations }, () => []), short: [], notTested: 0, missingGames: 0 };
  const lc = new Set([...counted].map((c) => c.toLowerCase()));
  items.forEach((it, index) => {
    const qty = Math.max(1, Math.round(it.qty) || 1);
    const wanted = index === 0 ? games : [];
    if (lc.has(it.type.toLowerCase())) { for (let st = 0; st < stations; st++) for (let k = 0; k < qty; k++) out.stations[st].push({ type: it.type, games: wanted, device: null }); return; }
    const r = pickDevices(all, { type: it.type, count: qty * stations, games: wanted, taken: used });
    for (let i = 0; i < qty * stations; i++) {
      const d = r.picked[i] ?? null;
      if (d) used.add(d.id);
      out.stations[Math.floor(i / qty)].push({ type: it.type, games: wanted, device: d });
    }
    out.notTested += r.notTested; out.missingGames += r.missingGames;
    if (r.short) out.short.push({ type: it.type, missing: r.short });
  });
  return out;
}

export interface Conflict { device_id: string; tag: string | null; kind: 'unusable' | 'double_booked' | 'missing_part' | 'not_tested'; detail: string }

// What to look at before the day: a device that can't be handed out, one booked for another event on overlapping dates, one with a part missing, and one never tested.
export function planConflicts(devices: Device[], bookedElsewhere: Map<string, string[]>): Conflict[] {
  const out: Conflict[] = [];
  for (const d of devices) {
    const label = d.tag ?? d.type;
    if (!isUsable(d)) out.push({ device_id: d.id, tag: d.tag, kind: 'unusable', detail: `${label} is marked ${d.condition.replace('_', ' ')}` });
    const other = bookedElsewhere.get(d.id);
    if (other?.length) out.push({ device_id: d.id, tag: d.tag, kind: 'double_booked', detail: `${label} is also in ${other.join(', ')}` });
    const miss = d.kit.filter((k) => k.missing).map((k) => k.item);
    if (miss.length) out.push({ device_id: d.id, tag: d.tag, kind: 'missing_part', detail: `${label} is missing ${miss.join(', ')}` });
    if (d.condition === 'not_tested') out.push({ device_id: d.id, tag: d.tag, kind: 'not_tested', detail: `${label} has not been tested` });
  }
  return out;
}

export const plansOverlap = (a: { starts_on: string; ends_on: string }, b: { starts_on: string; ends_on: string }) => a.starts_on <= b.ends_on && b.starts_on <= a.ends_on;
export const planIsToday = (p: { starts_on: string; ends_on: string; status: string }, today: string) => p.status === 'draft' && p.starts_on <= today && today <= p.ends_on;

// How far along each step is: done / total, counting only the devices going to the event whose step list includes that step.
export function stepProgress(devices: { id: string; kind: ItemKind }[], steps: StepDef[], done: Set<string>): { step: StepDef; done: number; total: number }[] {
  return steps.map((step) => {
    const mine = devices.filter((d) => stepAppliesTo(step, d.kind));
    return { step, total: mine.length, done: mine.filter((d) => done.has(`${d.id}:${step.id}`)).length };
  });
}

// ---- What is not done, or not right (shown in red / amber so it is spotted at a glance)

export interface PlanRow { id: string; kind: 'club' | 'sponsor' | 'officer' | 'slot'; type: string; tag: string | null; station_id: string | null; games_needed: string[]; games: string[]; counted: boolean; located?: boolean }
export interface StationInfo { id: string; name: string; contact: string | null; room: string | null; confirmed: boolean }
export interface Problem { sev: 'bad' | 'warn'; why: 'conflict' | 'empty' | 'game' | 'skipped' | 'team' | 'place'; station_id: string | null; row_id?: string; text: string }

// Which steps count for a row: a type-only row is club stock.
export const rowKind = (r: Pick<PlanRow, 'kind'>): ItemKind => (r.kind === 'slot' ? 'club' : r.kind);

// A step is "skipped" when a later step is ticked but an earlier one that applies is not (for example Box Taken ticked but Check done never was).
export function skippedSteps(row: Pick<PlanRow, 'id' | 'kind'>, steps: StepDef[], done: Set<string>): StepDef[] {
  const mine = stepsFor(steps, rowKind(row));
  const last = mine.reduce((m, s, i) => (done.has(`${row.id}:${s.id}`) ? i : m), -1);
  return mine.filter((s, i) => i < last && !done.has(`${row.id}:${s.id}`));
}

// Everything to fix before or on the day, worst first: rows with no device, devices that can't be handed out or are booked elsewhere, steps skipped, a team not confirmed,
// a game that isn't installed yet, a part missing, a team without a contact or room. `conflicts` come from the server (condition, double booking, parts).
export function planProblems(rows: PlanRow[], stations: StationInfo[], steps: StepDef[], done: Set<string>, conflicts: Conflict[], tagOf: (deviceId: string) => string | null): Problem[] {
  const out: Problem[] = [];
  const rowOf = new Map(rows.map((r) => [r.id, r]));
  for (const c of conflicts) {
    const row = rowOf.get(c.device_id);
    if (c.kind === 'unusable' || c.kind === 'double_booked') out.push({ sev: 'bad', why: 'conflict', station_id: row?.station_id ?? null, row_id: c.device_id, text: c.detail });
    else if (c.kind === 'missing_part') out.push({ sev: 'warn', why: 'conflict', station_id: row?.station_id ?? null, row_id: c.device_id, text: c.detail });
    else out.push({ sev: 'warn', why: 'conflict', station_id: row?.station_id ?? null, row_id: c.device_id, text: c.detail });
  }
  for (const r of rows) {
    if (r.kind === 'slot' && !r.counted) out.push({ sev: 'bad', why: 'empty', station_id: r.station_id, row_id: r.id, text: `No device chosen yet for ${r.type}${r.games_needed.length ? ` (needs ${r.games_needed.join(', ')})` : ''}` });
    const missing = r.games_needed.filter((g) => !r.games.some((x) => x.toLowerCase() === g.toLowerCase()));
    if (r.kind !== 'slot' && missing.length) out.push({ sev: 'warn', why: 'game', station_id: r.station_id, row_id: r.id, text: `${r.tag ?? r.type} needs ${missing.join(', ')} installed` });
    if (r.kind === 'club' && r.located === false) out.push({ sev: 'warn', why: 'place', station_id: r.station_id, row_id: r.id, text: `${r.tag ?? r.type} has no shelf or place set yet` });
    const skipped = skippedSteps(r, steps, done);
    if (skipped.length) out.push({ sev: 'bad', why: 'skipped', station_id: r.station_id, row_id: r.id, text: `${r.tag ?? r.type}: ${skipped.map((s) => s.name).join(', ')} skipped` });
  }
  for (const s of stations) {
    const n = rows.filter((r) => r.station_id === s.id).length;
    if (!n) continue;
    if (!s.confirmed) out.push({ sev: 'warn', why: 'team', station_id: s.id, text: `${s.name} hasn’t confirmed yet` });
    if (!s.contact) out.push({ sev: 'warn', why: 'team', station_id: s.id, text: `${s.name} has no contact` });
    if (!s.room) out.push({ sev: 'warn', why: 'team', station_id: s.id, text: `${s.name} has no room` });
  }
  void tagOf;
  return out.sort((a, b) => (a.sev === b.sev ? 0 : a.sev === 'bad' ? -1 : 1));
}

// Red if anything is wrong, amber if anything still needs a look, green when the station is ready.
export const stationStatus = (problems: Problem[], stationId: string | null): 'bad' | 'warn' | 'ok' => {
  const mine = problems.filter((p) => p.station_id === stationId);
  return mine.some((p) => p.sev === 'bad') ? 'bad' : mine.length ? 'warn' : 'ok';
};

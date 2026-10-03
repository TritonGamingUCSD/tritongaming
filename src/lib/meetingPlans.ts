// Meeting plans ("find a time"): the slot math shared by the portal UI and the API. Client-safe (no server imports).
//
// A plan has a grid of 30-minute slots: for a one-time plan, each day of its date range (days that have already passed drop
// out); for a weekly plan, each day Sunday (0) to Saturday (6). A person marks a slot 1 = available or 2 = if needed; anything
// they leave unmarked is unavailable. Answers belong to one plan only (nothing carries over from another).

export const SLOT_MIN = 30;
export const MAX_RANGE_DAYS = 14;
export type SlotValue = 1 | 2;
export type PlanSlots = Record<string, Record<string, SlotValue>>;

export interface PlanShape {
  kind: 'once' | 'weekly';
  duration_min: number;
  window_start: string;   // HH:MM or HH:MM:SS, Pacific
  window_end: string;
  range_start: string | null;
  range_end: string | null;
}

const hhmm = (t: string) => t.slice(0, 5);
export const toMin = (t: string) => { const [h, m] = hhmm(t).split(':').map(Number); return h * 60 + m; };
export const toHhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
export const addDays = (key: string, n: number) => { const d = new Date(`${key}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const daysBetween = (a: string, b: string) => Math.round((new Date(`${b}T12:00:00Z`).getTime() - new Date(`${a}T12:00:00Z`).getTime()) / 86_400_000);
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const dayLabel = (key: string, kind: 'once' | 'weekly') => kind === 'weekly' ? WEEKDAYS[Number(key)] : new Date(`${key}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' });
export const clockLabel = (t: string) => { const m = toMin(t); const h = Math.floor(m / 60); return `${h % 12 || 12}:${String(m % 60).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };

// Every slot start shown in a day: from the window start, while the slot still ends by the window end.
export function slotStarts(windowStart: string, windowEnd: string): string[] {
  const out: string[] = [];
  for (let m = toMin(windowStart); m + SLOT_MIN <= toMin(windowEnd); m += SLOT_MIN) out.push(toHhmm(m));
  return out;
}

// The days a plan still asks about. Past days of a one-time plan are dropped (today stays); a weekly plan is always Sunday to Saturday.
export function planDayKeys(plan: Pick<PlanShape, 'kind' | 'range_start' | 'range_end'>, today: string): string[] {
  if (plan.kind === 'weekly') return ['0', '1', '2', '3', '4', '5', '6'];
  if (!plan.range_start || !plan.range_end) return [];
  const out: string[] = [];
  for (let d = plan.range_start; d <= plan.range_end && out.length <= MAX_RANGE_DAYS; d = addDays(d, 1)) if (d >= today) out.push(d);
  return out;
}

// The 30-minute slot starts a meeting starting at `start` covers.
export function coveredSlots(start: string, durationMin: number): string[] {
  const out: string[] = [];
  for (let m = toMin(start); m < toMin(start) + durationMin; m += SLOT_MIN) out.push(toHhmm(m));
  return out;
}

// Can a meeting of this plan's length start at `start`? (It has to end by the window's end.)
export const canStartAt = (plan: Pick<PlanShape, 'duration_min' | 'window_start' | 'window_end'>, start: string) =>
  toMin(start) >= toMin(plan.window_start) && toMin(start) % SLOT_MIN === 0 && toMin(start) + plan.duration_min <= toMin(plan.window_end);

export type Availability = 'available' | 'if_needed' | 'unavailable';

// How someone's answers fit a meeting at day/start: unavailable if ANY covered slot is unmarked; if needed if any is "if needed".
export function availabilityFor(slots: PlanSlots | undefined, day: string, start: string, durationMin: number): Availability {
  const covered = coveredSlots(start, durationMin);
  const row = slots?.[day] ?? {};
  let needed = false;
  for (const s of covered) {
    const v = row[s];
    if (v !== 1 && v !== 2) return 'unavailable';
    if (v === 2) needed = true;
  }
  return needed ? 'if_needed' : 'available';
}

// Keeps only well-formed answers for days/slots the plan actually has.
export function cleanSlots(raw: unknown, days: string[], starts: string[]): PlanSlots {
  const out: PlanSlots = {};
  if (!raw || typeof raw !== 'object') return out;
  const allowed = new Set(starts);
  for (const day of days) {
    const row = (raw as Record<string, unknown>)[day];
    if (!row || typeof row !== 'object') continue;
    const clean: Record<string, SlotValue> = {};
    for (const [t, v] of Object.entries(row as Record<string, unknown>)) if (allowed.has(t) && (v === 1 || v === 2)) clean[t] = v;
    if (Object.keys(clean).length) out[day] = clean;
  }
  return out;
}

export interface Person { id: string; name: string }
export interface BestTime { day: string; start: string; available: Person[]; ifNeeded: Person[]; unavailable: Person[]; noResponse: Person[]; /** Of those unavailable: who has something on their calendar then (host only). */ blocked: { person: Person; titles: string[] }[] }

// Every possible start time, scored for the people who have answered (people who haven't answered are listed but don't count against it).
export function evaluateStart(day: string, start: string, durationMin: number, people: Person[], responses: Record<string, PlanSlots>, blocked?: Record<string, BusyBlock[]>): BestTime {
  const t: BestTime = { day, start, available: [], ifNeeded: [], unavailable: [], noResponse: [], blocked: [] };
  const covered = new Set(coveredSlots(start, durationMin));
  for (const p of people) {
    // Something already on their calendar then: unavailable for sure (even if they haven't answered).
    const titles = [...new Set((blocked?.[p.id] ?? []).filter((b) => b.day === day && [...covered].some((s) => toMin(s) < toMin(b.end) && toMin(s) + SLOT_MIN > toMin(b.start))).map((b) => b.title))];
    if (titles.length) { t.blocked.push({ person: p, titles }); t.unavailable.push(p); continue; }
    const r = responses[p.id];
    if (!r) { t.noResponse.push(p); continue; }
    const a = availabilityFor(r, day, start, durationMin);
    (a === 'available' ? t.available : a === 'if_needed' ? t.ifNeeded : t.unavailable).push(p);
  }
  return t;
}

// The best few times: fewest people unavailable first, then most fully available, then earliest.
// A person blocked by their calendar counts double against a time (they are unavailable for sure, not just by choice).
export const penalty = (t: BestTime) => t.unavailable.length + t.blocked.length;
export function bestTimes(plan: PlanShape, days: string[], people: Person[], responses: Record<string, PlanSlots>, limit = 3, blocked?: Record<string, BusyBlock[]>): BestTime[] {
  const all: BestTime[] = [];
  for (const day of days) for (const start of slotStarts(plan.window_start, plan.window_end)) {
    if (!canStartAt(plan, start)) continue;
    all.push(evaluateStart(day, start, plan.duration_min, people, responses, blocked));
  }
  const dayIdx = new Map(days.map((d, i) => [d, i]));
  return all
    .filter((t) => t.available.length + t.ifNeeded.length > 0)
      .sort((a, b) => penalty(a) - penalty(b) || a.blocked.length - b.blocked.length || b.available.length - a.available.length || a.ifNeeded.length - b.ifNeeded.length || (dayIdx.get(a.day)! - dayIdx.get(b.day)!) || toMin(a.start) - toMin(b.start))
    .slice(0, limit);
}

// Has this person marked at least one available / if-needed slot on the grid as it is now? Someone who saved an empty grid hasn't
// really answered yet: it counts as still to do.
export function hasAnySlot(slots: PlanSlots | undefined, days: string[], starts: string[]): boolean {
  if (!slots) return false;
  const ok = new Set(starts);
  return days.some((d) => Object.entries(slots[d] ?? {}).some(([t, v]) => ok.has(t) && (v === 1 || v === 2)));
}

export const AUTO_ABSENT_REASON = 'Not available at the chosen time';

// What the API sends for one plan (see /api/meeting-plans).
export interface PlanView {
  id: string;
  kind: 'once' | 'weekly';
  title: string;
  description: string | null;
  location: string | null;
  duration_min: number;
  window_start: string;
  window_end: string;
  range_start: string | null;
  range_end: string | null;
  answer_by: string | null;
  status: 'open' | 'decided';
  decided_slot: { day?: string; weekday?: number; start: string } | null;
  meeting_id: string | null;
  series_id: string | null;
  host_id: string | null;
  host_name: string | null;
  /** The days still asked about (a one-time plan's past days are already dropped). */
  days: string[];
  /** A one-time plan whose days have all passed: the host needs to pick new dates. */
  expired: boolean;
  /** Everyone asked to answer: the audience plus the host. */
  people: Person[];
  responses: Record<string, PlanSlots>;
  mine: PlanSlots | null;
  isHost: boolean;
  canManage: boolean;
  audience: string[] | null;
  invitees: string[] | null;
  group_ids: string[] | null;
  groupNames: string[];
  /** Can the host still take the decision back? */
  canReopen: boolean;
  /** For the host: what is on each person's Triton Gaming calendar (as of their last save), used to rank times. */
  blocked: Record<string, BusyBlock[]>;
  /** Times already taken on MY Triton Gaming calendar (meetings, events I'm going to): unavailable for sure. */
  busy: BusyBlock[];
}

// Something already on a person's calendar. `day` is a date (one-time plan) or a weekday 0-6 (weekly plan); times are Pacific HH:MM.
export interface BusyBlock { day: string; start: string; end: string; title: string; /** Why it is blocked, in plain words. */ why: string }

// The slots (by start time) that these blocks take on a day, with what is on at that time.
export function busySlots(blocks: BusyBlock[], day: string, starts: string[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const b of blocks) {
    if (b.day !== day) continue;
    for (const t of starts) if (toMin(t) < toMin(b.end) && toMin(t) + SLOT_MIN > toMin(b.start) && !out.has(t)) out.set(t, b.title);
  }
  return out;
}

// Answers without the slots that are already taken (you can't be available then).
export function withoutBusy(slots: PlanSlots, blocks: BusyBlock[], starts: string[]): PlanSlots {
  const out: PlanSlots = {};
  for (const [day, row] of Object.entries(slots)) {
    const taken = busySlots(blocks, day, starts);
    const keep = Object.fromEntries(Object.entries(row).filter(([t]) => !taken.has(t)));
    if (Object.keys(keep).length) out[day] = keep as PlanSlots[string];
  }
  return out;
}

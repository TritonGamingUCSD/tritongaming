import type { SupabaseClient } from '@supabase/supabase-js';
import { announce, planTopic } from '@/lib/logistics/live';
import { plansOverlap, type Applies, type StepDef } from '@/lib/logistics/plans';

export const UUID = /^[0-9a-f-]{36}$/i;
export const PLAN_COLUMNS = 'id, slug, name, event_id, starts_on, ends_on, status, notes, created_at, updated_at';
export const DEVICE_COLUMNS = 'id, tag, name, type, shelf, tier, place_note, condition, ports, login, games, kit, quantity, quantity_is_estimate, notes, created_at, updated_at';
export const SLOT_COLUMNS = 'id, plan_id, station_id, type, games, label, sort, set_id, request_id, request_item';
export const BORROWED_COLUMNS = 'id, plan_id, tag, name, type, owner_kind, sponsor_id, owner_user_id, owner_note, station_id, role, swap_reason, swapped_for_label, kit, notes, games_needed, games, sort, set_id, request_id, request_item';

// Today's date in Pacific time (the club's calendar), as YYYY-MM-DD.
export const pacificToday = (now = new Date()): string => now.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
export const dayOf = (iso: string | null | undefined): string | null => (iso ? new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }) : null);

export async function loadSteps(svc: SupabaseClient): Promise<StepDef[]> {
  const { data } = await svc.from('logistics_options').select('id, value, sort, meta').eq('kind', 'step').order('sort').limit(50);
  return (data ?? []).map((o) => ({ id: o.id as string, name: o.value as string, sort: o.sort as number, applies: (((o.meta as { applies?: Applies } | null)?.applies) ?? 'all') as Applies, kit: !!(o.meta as { kit?: boolean } | null)?.kit }));
}

// A request's allocation can be locked (logistics_requests.allocation_locked): its device rows, its station's prizes and what it asks for then can't be changed until it is unlocked.
export const LOCKED_MESSAGE = 'That belongs to a request whose allocation is locked. Unlock the request first.';
export async function lockedRequestIds(svc: SupabaseClient, planId: string): Promise<Set<string>> {
  const { data } = await svc.from('logistics_requests').select('id').eq('plan_id', planId).eq('allocation_locked', true);
  return new Set((data ?? []).map((r) => r.id as string));
}
// True when any of these rows (empty rows, devices, loaners of the plan) came from a locked request.
export async function rowsLocked(svc: SupabaseClient, planId: string, f: { slotIds?: string[]; deviceIds?: string[]; borrowedIds?: string[] }): Promise<boolean> {
  const locked = [...(await lockedRequestIds(svc, planId))];
  if (!locked.length) return false;
  const found = await Promise.all([
    f.slotIds?.length ? svc.from('logistics_plan_slots').select('id').eq('plan_id', planId).in('id', f.slotIds).in('request_id', locked) : null,
    f.deviceIds?.length ? svc.from('logistics_plan_devices').select('device_id').eq('plan_id', planId).in('device_id', f.deviceIds).in('request_id', locked) : null,
    f.borrowedIds?.length ? svc.from('logistics_plan_borrowed').select('id').eq('plan_id', planId).in('id', f.borrowedIds).in('request_id', locked) : null,
  ]);
  return found.some((r) => (r?.data?.length ?? 0) > 0);
}
// True when the station's prize request is locked.
export async function stationLocked(svc: SupabaseClient, planId: string, stationId: string): Promise<boolean> {
  const { data } = await svc.from('logistics_stations').select('prize_request_id').eq('id', stationId).eq('plan_id', planId).maybeSingle();
  const rid = data?.prize_request_id as string | null | undefined;
  return !!rid && (await lockedRequestIds(svc, planId)).has(rid);
}

// Any change to a plan's makeup bumps this, which is what other phones compare to know they should reload (see the version route).
// (`stampPlan` moves the stamp without a message: for changes that announce themselves, like a station's number for a prize.)
export async function stampPlan(svc: SupabaseClient, planId: string) {
  await svc.from('logistics_plans').update({ updated_at: new Date().toISOString() }).eq('id', planId);
}
export async function touchPlan(svc: SupabaseClient, planId: string) {
  await stampPlan(svc, planId);
  await announce(planTopic(planId), { k: 'plan', plan: planId });   // everyone with this event open reads it again
}

// Devices in this plan that are also going (as planned, not spare) to another event whose dates overlap, by device id -> the other events' names.
export async function bookedElsewhere(svc: SupabaseClient, plan: { id: string; starts_on: string; ends_on: string }, deviceIds: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (!deviceIds.length) return out;
  const { data: others } = await svc.from('logistics_plans').select('id, name, starts_on, ends_on').eq('status', 'draft').neq('id', plan.id).lte('starts_on', plan.ends_on).gte('ends_on', plan.starts_on);
  const overlapping = (others ?? []).filter((o) => plansOverlap(plan, o as { starts_on: string; ends_on: string }));
  if (!overlapping.length) return out;
  const names = new Map(overlapping.map((o) => [o.id as string, o.name as string]));
  const { data: rows } = await svc.from('logistics_plan_devices').select('plan_id, device_id').in('plan_id', [...names.keys()]).eq('role', 'planned').in('device_id', deviceIds);
  for (const r of rows ?? []) out.set(r.device_id as string, [...(out.get(r.device_id as string) ?? []), names.get(r.plan_id as string)!]);
  return out;
}

// The same overlap, for choosing devices: ids that are taken by other plans on those dates.
export async function takenByOthers(svc: SupabaseClient, plan: { id: string; starts_on: string; ends_on: string }): Promise<Set<string>> {
  const { data: others } = await svc.from('logistics_plans').select('id, starts_on, ends_on').eq('status', 'draft').neq('id', plan.id).lte('starts_on', plan.ends_on).gte('ends_on', plan.starts_on);
  const ids = (others ?? []).map((o) => o.id as string);
  if (!ids.length) return new Set();
  const { data } = await svc.from('logistics_plan_devices').select('device_id').in('plan_id', ids).eq('role', 'planned');
  return new Set((data ?? []).map((r) => r.device_id as string));
}

// Who a borrowed device belongs to, as words: the sponsor's name, or the officer's.
export async function ownerNames(svc: SupabaseClient, rows: { sponsor_id: string | null; owner_user_id: string | null }[]): Promise<{ sponsors: Map<string, string>; people: Map<string, string> }> {
  const sIds = [...new Set(rows.map((r) => r.sponsor_id).filter((x): x is string => !!x))];
  const pIds = [...new Set(rows.map((r) => r.owner_user_id).filter((x): x is string => !!x))];
  const [s, p] = await Promise.all([
    sIds.length ? svc.from('logistics_sponsors').select('id, name').in('id', sIds) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    pIds.length ? svc.from('profiles').select('id, display_name').in('id', pIds) : Promise.resolve({ data: [] as { id: string; display_name: string | null }[] }),
  ]);
  return { sponsors: new Map((s.data ?? []).map((x) => [x.id as string, x.name as string])), people: new Map((p.data ?? []).map((x) => [x.id as string, ((x as { display_name?: string | null }).display_name as string | null) || 'Unnamed'])) };
}

export interface SlotRow { id: string; plan_id: string; station_id: string | null; type: string; games: string[]; label: string | null; sort: number; set_id?: string | null; request_id?: string | null; request_item?: string | null }
export interface BorrowedRow { games_needed: string[]; games?: string[]; sort: number; set_id?: string | null; request_id?: string | null; request_item?: string | null; id: string; plan_id: string; tag: string; name: string | null; type: string; owner_kind: 'sponsor' | 'officer'; sponsor_id: string | null; owner_user_id: string | null; owner_note: string | null; station_id: string | null; role: 'planned' | 'backup'; swap_reason: string | null; swapped_for_label: string | null; kit: { item: string; qty: number; missing: boolean }[]; notes: string | null }
export const ownerLabelOf = (b: Pick<BorrowedRow, 'owner_kind' | 'sponsor_id' | 'owner_user_id'>, n: Awaited<ReturnType<typeof ownerNames>>) =>
  b.owner_kind === 'sponsor' ? (b.sponsor_id ? n.sponsors.get(b.sponsor_id) : null) ?? 'a sponsor' : (b.owner_user_id ? n.people.get(b.owner_user_id) : null) ?? 'an officer';

// What the event-day screen shows about any item in a plan, club device or borrowed: what it is, where to get it, its parts.
export interface SlimItem { id: string; kind: 'club' | 'sponsor' | 'officer' | 'slot'; games_needed?: string[]; label?: string | null; tag: string | null; name: string | null; type: string; shelf: string | null; tier: string | null; place_note: string | null; owner: string | null; condition: string | null; kit: unknown }
export const slimClub = (d: { id: string; tag: string | null; name: string | null; type: string; shelf: string | null; tier: string | null; place_note: string | null; condition: string; kit: unknown }): SlimItem =>
  ({ id: d.id, kind: 'club', tag: d.tag, name: d.name, type: d.type, shelf: d.shelf, tier: d.tier, place_note: d.place_note, owner: null, condition: d.condition, kit: d.kit });
export const slimSlot = (r: SlotRow): SlimItem => ({ id: r.id, kind: 'slot', tag: null, name: null, type: r.type, shelf: null, tier: null, place_note: null, owner: null, condition: null, kit: [], games_needed: r.games, label: r.label });
export const slimBorrowed = (b: BorrowedRow, owner: string): SlimItem =>
  ({ id: b.id, kind: b.owner_kind, tag: b.tag, name: b.name, type: b.type, shelf: null, tier: null, place_note: b.owner_note, owner, condition: null, kit: b.kit });

// Finds what a person typed (or tapped) in a plan: a borrowed device of THIS event first (its ID only has to be unique here), then the inventory.
export async function findItem(svc: SupabaseClient, planId: string, input: { tag?: unknown; device_id?: unknown; borrowed_id?: unknown; slot_id?: unknown }):
  Promise<{ kind: 'club'; device: Record<string, unknown> } | { kind: 'borrowed'; row: BorrowedRow } | { kind: 'slot'; row: SlotRow } | null> {
  if (typeof input.slot_id === 'string' && UUID.test(input.slot_id)) {
    const { data } = await svc.from('logistics_plan_slots').select(SLOT_COLUMNS).eq('id', input.slot_id).eq('plan_id', planId).maybeSingle();
    return data ? { kind: 'slot', row: data as unknown as SlotRow } : null;
  }
  if (typeof input.borrowed_id === 'string' && UUID.test(input.borrowed_id)) {
    const { data } = await svc.from('logistics_plan_borrowed').select(BORROWED_COLUMNS).eq('id', input.borrowed_id).eq('plan_id', planId).maybeSingle();
    return data ? { kind: 'borrowed', row: data as unknown as BorrowedRow } : null;
  }
  if (typeof input.device_id === 'string' && UUID.test(input.device_id)) {
    const { data } = await svc.from('logistics_devices').select(DEVICE_COLUMNS).eq('id', input.device_id).maybeSingle();
    return data ? { kind: 'club', device: data as unknown as Record<string, unknown> } : null;
  }
  const key = String(input.tag ?? '').toLowerCase().replace(/\s+/g, '');
  if (!key) return null;
  const { data: b } = await svc.from('logistics_plan_borrowed').select(BORROWED_COLUMNS).eq('plan_id', planId).eq('tag_key', key).maybeSingle();
  if (b) return { kind: 'borrowed', row: b as unknown as BorrowedRow };
  const { data } = await svc.from('logistics_devices').select(DEVICE_COLUMNS).eq('tag_key', key).maybeSingle();
  return data ? { kind: 'club', device: data as unknown as Record<string, unknown> } : null;
}

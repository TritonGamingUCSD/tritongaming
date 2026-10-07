import type { SupabaseClient } from '@supabase/supabase-js';
import { slotRange, type ShiftPlan } from '@/lib/shifts/shifts';

export interface MyShift {
  eventId: string; eventTitle: string; stationId: string; stationName: string; slot: number;
  category: 'general' | 'team'; teamLabel: string | null; location: string | null;
  start: string; end: string; arrived: boolean;
}

// The signed-in person's shifts that are running now or still to come (within a week), soonest first, for the dashboard's "Now and next".
export async function getMyShifts(svc: SupabaseClient, userId: string, limit = 4): Promise<MyShift[]> {
  const now = Date.now();
  return (await loadMyShifts(svc, userId, now, now + 7 * 86_400_000)).slice(0, limit);
}

// The person's shifts that overlap a window (epoch ms), soonest first, with back-to-back slots at one station merged into one block.
export async function loadMyShifts(svc: SupabaseClient, userId: string, fromMs: number, toMs: number): Promise<MyShift[]> {
  const { data: mine } = await svc.from('shift_signups').select('event_id, station_id, slot_index, arrived_at').eq('user_id', userId);
  if (!mine?.length) return [];
  const eventIds = [...new Set(mine.map((m) => m.event_id as string))];
  const stationIds = [...new Set(mine.map((m) => m.station_id as string))];
  const [{ data: plans }, { data: events }, { data: stations }, { data: guides }] = await Promise.all([
    svc.from('event_shifts').select('event_id, starts_at, ends_at, slot_minutes').in('event_id', eventIds),
    svc.from('events').select('id, title').in('id', eventIds),
    svc.from('shift_stations').select('id, name, category, team_label, location').in('id', stationIds),
    svc.from('shift_event_guides').select('event_id, station_id, location').in('event_id', eventIds),
  ]);
  const plan = new Map((plans ?? []).map((p) => [p.event_id as string, p as unknown as ShiftPlan]));
  const title = new Map((events ?? []).map((e) => [e.id as string, e.title as string]));
  const station = new Map((stations ?? []).map((s) => [s.id as string, s]));
  const where = new Map((guides ?? []).map((g) => [`${g.event_id}|${g.station_id}`, g.location as string | null]));
  const out: MyShift[] = [];
  for (const m of mine) {
    const p = plan.get(m.event_id as string), st = station.get(m.station_id as string);
    if (!p || !st) continue;
    const r = slotRange(p, m.slot_index as number);
    if (r.end.getTime() <= fromMs || r.start.getTime() > toMs) continue;
    out.push({
      eventId: m.event_id as string, eventTitle: title.get(m.event_id as string) ?? 'Event', stationId: m.station_id as string, stationName: st.name as string, slot: m.slot_index as number,
      category: st.category as 'general' | 'team', teamLabel: (st.team_label as string | null) ?? null,
      location: where.get(`${m.event_id}|${m.station_id}`) || (st.location as string | null) || null,
      start: r.start.toISOString(), end: r.end.toISOString(), arrived: !!m.arrived_at,
    });
  }
  // Back-to-back slots at the same station read as one block ("4:46 to 6:46 PM"); checking in on the first slot covers the block.
  const merged: MyShift[] = [];
  for (const sh of out.sort((x, y) => x.start.localeCompare(y.start))) {
    const prev = merged[merged.length - 1];
    if (prev && prev.eventId === sh.eventId && prev.stationId === sh.stationId && prev.end === sh.start) prev.end = sh.end;
    else merged.push({ ...sh });
  }
  return merged;
}

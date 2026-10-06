import { createServiceClient } from '@/lib/supabase/admin';
import { STATION_COLS, type ShiftPlan, type ShiftStation } from '@/lib/shifts';
import { withDocTitles } from '@/lib/shiftsServer';

export interface ShiftEvent { id: string; title: string; start_date: string; end_date: string | null; location: string | null; plan: ShiftPlan | null }

// The events shifts can be set up for (only ones that have not ended yet), with whether each already has a grid and whether signup is open.
export async function getShiftsData(canManage = false) {
  const svc = createServiceClient();
  const now = new Date().toISOString();
  const [{ data: events }, { data: plans }, { data: stations }, { data: docs }] = await Promise.all([
    svc.from('events').select('id, title, start_date, end_date, location').eq('is_published', true).or(`end_date.gte.${now},and(end_date.is.null,start_date.gte.${now})`).order('start_date').limit(30),
    svc.from('event_shifts').select('event_id, starts_at, ends_at, slot_minutes, signup_open, team_only, min_per_person'),
    svc.from('shift_stations').select(STATION_COLS).order('sort_order').order('name'),
    // Only exec need the list of portal docs (to link a script to a station).
    canManage ? svc.from('docs').select('id, title').order('title') : Promise.resolve({ data: [] as { id: string; title: string }[] }),
  ]);
  const byEvent = new Map((plans ?? []).map((p) => [p.event_id as string, p as ShiftPlan]));
  return {
    events: (events ?? []).map((e) => ({ ...(e as Omit<ShiftEvent, 'plan'>), plan: byEvent.get(e.id as string) ?? null })) as ShiftEvent[],
    stations: await withDocTitles(svc, (stations ?? []) as ShiftStation[]),
    docs: (docs ?? []) as { id: string; title: string }[],
  };
}

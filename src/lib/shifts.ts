// Shift grids: stations (rows) by time slots (columns) for one event. Pure helpers shared by the API and the portal.
export interface ShiftStation { id: string; name: string; default_needed: number; sort_order: number; description: string | null }
export interface ShiftPlan { event_id: string; starts_at: string; ends_at: string; slot_minutes: number; signup_open: boolean; team_only: boolean; min_per_person: number | null }
export interface ShiftSignup { id: string; station_id: string; slot_index: number; user_id: string; name: string; avatar: string | null }
export interface ShiftAbsence { id: string; user_id: string; name: string; starts_at: string; ends_at: string; needs: number }
export interface ShiftGrid {
  event: { id: string; title: string; start_date: string; location: string | null };
  plan: ShiftPlan | null;
  stations: ShiftStation[];
  overrides: Record<string, number>;   // "<station id>|<slot index>" -> needed
  signups: ShiftSignup[];
  /** With a requirement set: the active officers and leads below it (managers only). */
  requirement: { min: number; people: { id: string; name: string; count: number; need: number; absent: boolean }[]; exempt: { id: string; name: string; count: number; reason: 'event' | 'inactive'; note: string | null }[] } | null;
  roster: { id: string; name: string }[];   // everyone exec can put on a shift: officers, leads and exec (managers only)
  officers: { id: string; name: string }[];   // active officers and leads (managers only), for marking time away
  exemptions: { id: string; user_id: string; name: string; note: string | null }[];   // exempt from the requirement for this event (managers only)
  absences: ShiftAbsence[];   // times people are away (managers see everyone's, everyone else sees their own)
  me: string;
  canManage: boolean;
  canSignUp: boolean;
}

export const SLOT_CHOICES = [15, 30, 45, 60, 90, 120];
export const MAX_SLOTS = 48;

export const cellKey = (stationId: string, slot: number) => `${stationId}|${slot}`;

export function slotCount(plan: Pick<ShiftPlan, 'starts_at' | 'ends_at' | 'slot_minutes'>): number {
  const ms = new Date(plan.ends_at).getTime() - new Date(plan.starts_at).getTime();
  return Math.max(0, Math.min(MAX_SLOTS, Math.ceil(ms / (plan.slot_minutes * 60_000))));
}

export function slotRange(plan: Pick<ShiftPlan, 'starts_at' | 'ends_at' | 'slot_minutes'>, index: number): { start: Date; end: Date } {
  const start = new Date(new Date(plan.starts_at).getTime() + index * plan.slot_minutes * 60_000);
  const end = new Date(Math.min(start.getTime() + plan.slot_minutes * 60_000, new Date(plan.ends_at).getTime()));
  return { start, end };
}

/** How many people a cell needs: its own override if one was set, otherwise the station's default. */
/** Does the person's time away overlap this slot? */
export function awayDuring(absences: Pick<ShiftAbsence, 'starts_at' | 'ends_at'>[], range: { start: Date; end: Date }): boolean {
  return absences.some((a) => new Date(a.starts_at) < range.end && new Date(a.ends_at) > range.start);
}

export function neededFor(grid: Pick<ShiftGrid, 'overrides' | 'stations'>, stationId: string, slot: number): number {
  const o = grid.overrides[cellKey(stationId, slot)];
  if (o !== undefined) return o;
  return grid.stations.find((s) => s.id === stationId)?.default_needed ?? 0;
}

/** The roles that may claim cells: officers, leads and exec; with team_only off, recruits too. Being marked inactive for a quarter (a marker next to the real roles) does not stop anyone: they can still fill themselves in. */
export function mayClaim(roles: { role: string }[], teamOnly: boolean): boolean {
  return roles.some((r) => ['officer', 'lead', 'exec', 'admin'].includes(r.role) || (!teamOnly && r.role === 'recruit'));
}

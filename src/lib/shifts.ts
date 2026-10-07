// Shift grids: stations (rows) by time slots (columns) for one event. Pure helpers shared by the API and the portal.
export interface ShiftStation {
  id: string; name: string; default_needed: number; sort_order: number;
  /** 'general' shifts are for anyone; 'team' ones are for a specific team (a warning, never a block, for everyone else). */
  category: 'general' | 'team'; team_label: string | null;
  /** Which table of the grid it sits in (East Ballroom, Theater...). Blank = no area. */
  area: string | null;
  /** The station guide, readable by everyone who can see shifts. */
  location: string | null; instructions: string | null; doc_id: string | null; doc_title?: string | null; link_url: string | null; link_label: string | null;
}
export interface ShiftTemplate { id: string; name: string; body: string; sort_order: number }
export const STATION_COLS = 'id, name, default_needed, sort_order, category, team_label, area, location, instructions, doc_id, link_url, link_label';
/** What exec changed for one event on top of a station's guide. Blank fields fall back to the station. */
export interface ShiftEventGuide { location: string | null; notes: string | null; doc_id: string | null; doc_title?: string | null; link_url: string | null; link_label: string | null }
export interface ShiftPlan { event_id: string; starts_at: string; ends_at: string; slot_minutes: number; signup_open: boolean; team_only: boolean; min_per_person: number | null }
export interface ShiftSignup { id: string; station_id: string; slot_index: number; user_id: string; name: string; avatar: string | null; arrived_at: string | null }
export interface ShiftCover { id: string; station_id: string; slot_index: number; requester_id: string; requester_name: string; note: string | null; status: 'open' | 'taken'; taken_by: string | null; taken_by_name: string | null }
export interface ShiftChecklistItem { id: string; label: string; done_by_name: string | null; done_at: string | null }
export interface ShiftAbsence { id: string; user_id: string; name: string; starts_at: string; ends_at: string; needs: number }
export interface ShiftGrid {
  event: { id: string; title: string; start_date: string; location: string | null };
  plan: ShiftPlan | null;
  stations: ShiftStation[];
  eventGuides: Record<string, ShiftEventGuide>;   // by station id
  overrides: Record<string, number>;   // "<station id>|<slot index>" -> needed
  signups: ShiftSignup[];
  /** With a requirement set: the active officers and leads below it (managers only). */
  requirement: { min: number; people: { id: string; name: string; count: number; need: number; absent: boolean }[]; exempt: { id: string; name: string; count: number; reason: 'event' | 'inactive'; note: string | null }[] } | null;
  roster: { id: string; name: string }[];   // everyone exec can put on a shift: officers, leads and exec (managers only)
  officers: { id: string; name: string }[];   // active officers and leads (managers only), for marking time away
  exemptions: { id: string; user_id: string; name: string; note: string | null }[];   // exempt from the requirement for this event (managers only)
  checklists: Record<string, ShiftChecklistItem[]>;   // by station id, for this event
  covers: ShiftCover[];   // open cover requests, plus the ones taken in the last week (so exec can undo them)
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

export function neededFor(grid: { overrides: Record<string, number>; stations: Pick<ShiftStation, 'id' | 'default_needed'>[] }, stationId: string, slot: number): number {
  const o = grid.overrides[cellKey(stationId, slot)];
  if (o !== undefined) return o;
  return grid.stations.find((s) => s.id === stationId)?.default_needed ?? 0;
}

/** The roles that may claim cells: officers, leads and exec; with team_only off, recruits too. Being marked inactive for a quarter (a marker next to the real roles) does not stop anyone: they can still fill themselves in. */
export function mayClaim(roles: { role: string }[], teamOnly: boolean): boolean {
  return roles.some((r) => ['officer', 'lead', 'exec', 'admin'].includes(r.role) || (!teamOnly && r.role === 'recruit'));
}

/** The guide a person sees for a station at this event: what exec wrote for this event, falling back to anything saved on the station itself. */
export function guideFor(station: ShiftStation, eg: ShiftEventGuide | undefined) {
  return {
    location: eg?.location || station.location,
    instructions: eg?.notes || station.instructions,
    notes: null as string | null,
    doc_id: eg?.doc_id ?? station.doc_id,
    doc_title: eg?.doc_id ? eg.doc_title ?? null : station.doc_title ?? null,
    link_url: eg?.link_url || station.link_url,
    link_label: eg?.link_url ? eg.link_label : station.link_label,
  };
}

/** The stations split into one table per area, in the order each area first appears. With no areas at all there is a single group and no heading. */
export function groupByArea<T extends Pick<ShiftStation, 'area'>>(stations: T[]): { key: string; area: string | null; label: string; stations: T[] }[] {
  const named = stations.some((s) => s.area);
  if (!named) return stations.length ? [{ key: '', area: null, label: '', stations }] : [];
  const groups = new Map<string, { key: string; area: string | null; label: string; stations: T[] }>();
  for (const s of stations) {
    const key = s.area ?? '';
    if (!groups.has(key)) groups.set(key, { key, area: s.area, label: s.area ?? 'Other stations', stations: [] });
    groups.get(key)!.stations.push(s);
  }
  return [...groups.values()];
}

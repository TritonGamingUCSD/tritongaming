import type { PlanRow } from '@/lib/logistics/plans';
import type { ItemKind } from '@/lib/logistics/constants';
import type { KitLine, PlanDetail } from './usePlans';

// Everything in a plan as one kind of row: a club device, a borrowed one, or an empty row that has a type but no device yet. Used by the plan screen and the event-day screen.
export interface Row extends PlanRow {
  key: string; tag: string | null; name: string | null; where: string; role: 'planned' | 'backup'; condition: string | null; kit: KitLine[];
  swap_reason: string | null; swapped_for_label: string | null; label: string | null; itemKind: ItemKind; stationId: string | null; sort: number; setId: string | null; located: boolean; requestId: string | null; requestItem: string | null;
}

const place = (d: { shelf: string | null; tier: string | null }) => [d.shelf, d.tier].filter(Boolean).join(' · ');

export function planRows(detail: PlanDetail, counted: Set<string>): Row[] {
  const lc = new Set([...counted].map((c) => c.toLowerCase()));
  const club = detail.items.map((i): Row => ({
    id: i.device_id, key: i.device_id, kind: 'club', itemKind: 'club', type: i.device.type, tag: i.device.tag, name: i.device.name, station_id: i.station_id, stationId: i.station_id,
    games_needed: i.games_needed ?? [], games: i.device.games, counted: false, role: i.role, condition: i.device.condition, kit: i.device.kit,
    where: `${place(i.device) || 'No place set'}${i.device.place_note ? ` · ${i.device.place_note}` : ''}`, located: !!place(i.device), swap_reason: i.swap_reason, swapped_for_label: i.swapped_for_label, label: null, sort: i.sort ?? 1000, requested: i.role === 'backup' || !!i.request_id, requestId: i.request_id ?? null, requestItem: i.request_item ?? null, setId: i.set_id ?? null,
  }));
  const borrowed = detail.borrowed.map((b): Row => ({
    id: b.id, key: b.id, kind: b.owner_kind, itemKind: b.owner_kind, type: b.type, tag: b.tag, name: b.name, station_id: b.station_id, stationId: b.station_id,
    games_needed: b.games_needed ?? [], games: b.games ?? [], counted: false, role: b.role, condition: null, kit: b.kit,
    where: `${b.owner_kind === 'sponsor' ? 'Sponsor' : 'Officer loan'}: ${b.owner}${b.owner_note ? ` · ${b.owner_note}` : ''}`, located: true, swap_reason: b.swap_reason, swapped_for_label: b.swapped_for_label, label: null, sort: b.sort ?? 1000, setId: b.set_id ?? null, requested: !!b.request_id || b.role === 'backup' || !b.station_id, requestId: b.request_id ?? null, requestItem: b.request_item ?? null,
  }));
  const slots = detail.slots.map((s): Row => ({
    id: s.id, key: s.id, kind: 'slot', itemKind: 'club', type: s.type, tag: null, name: null, station_id: s.station_id, stationId: s.station_id, games_needed: s.games, games: [],
    counted: lc.has(s.type.toLowerCase()), role: 'planned', condition: null, kit: [], where: s.label ?? '', located: true, swap_reason: null, swapped_for_label: null, label: s.label, sort: s.sort, setId: s.set_id ?? null, requested: !!s.request_id, requestId: s.request_id ?? null, requestItem: s.request_item ?? null,
  }));
  // The order they were planned in; anything added by hand later (sort 1000) goes after, by ID.
  return [...club, ...borrowed, ...slots].sort((a, b) => a.sort - b.sort || (a.tag ?? a.type).localeCompare(b.tag ?? b.type, undefined, { numeric: true, sensitivity: 'base' }));
}

// Rows as lines: every device is a line of one row; counted things (a mousepad, one row per unit) on one team share a line, so "Mousepad ×4" is one line with a number.
export interface Line { key: string; rows: Row[]; counted: boolean }
export function lines(rows: Row[]): Line[] {
  const out: Line[] = [];
  const seen = new Map<string, Line>();
  for (const r of rows) {
    if (r.kind === 'slot' && r.counted) {
      const k = `${r.stationId ?? ''}|${r.setId ?? ''}|${r.type}|${r.games_needed.join(',')}|${r.label ?? ''}`;
      const have = seen.get(k);
      if (have) { have.rows.push(r); continue; }
      const l: Line = { key: k, rows: [r], counted: true };
      seen.set(k, l); out.push(l);
    } else out.push({ key: r.key, rows: [r], counted: false });
  }
  return out;
}

// A unit is what gets one line on the sheet: a single device (or counted line), or a set (the rows made together from a bundle, like a PC with its monitor, keyboard and mouse).
export interface Unit { key: string; lines: Line[]; set: boolean }
export function units(rows: Row[]): Unit[] {
  const size = new Map<string, number>();
  for (const r of rows) if (r.setId) size.set(r.setId, (size.get(r.setId) ?? 0) + 1);
  const out: Unit[] = [];
  const bySet = new Map<string, Unit>();
  for (const l of lines(rows)) {
    const sid = l.rows[0].setId;
    if (sid && (size.get(sid) ?? 0) > 1) {
      let u = bySet.get(sid);
      if (!u) { u = { key: `set:${sid}`, lines: [], set: true }; bySet.set(sid, u); out.push(u); }
      u.lines.push(l);
    } else out.push({ key: l.key, lines: [l], set: false });
  }
  return out;
}

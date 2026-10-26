// The Devices page's groupings (no database, no React): how the rows of an event, or the devices in storage, are put into groups.

export type DeviceGroup = 'station' | 'type' | 'shelf' | 'status' | 'owner' | 'games' | 'none';
export const DEVICE_GROUPS: { id: DeviceGroup; label: string }[] = [
  { id: 'station', label: 'Station' }, { id: 'type', label: 'Type' }, { id: 'shelf', label: 'Shelf' }, { id: 'status', label: 'Status' }, { id: 'owner', label: 'Owner' }, { id: 'games', label: 'Games' }, { id: 'none', label: 'No Groups' },
];
export const isDeviceGroup = (v: unknown): v is DeviceGroup => DEVICE_GROUPS.some((g) => g.id === v);

export interface GroupableRow {
  id: string; kind: 'club' | 'sponsor' | 'officer' | 'slot'; type: string; where: string; located: boolean; games_needed: string[]; games: string[];
}
export interface GroupCtx<T = GroupableRow> { attention: (row: T) => boolean; complete: (row: T) => boolean; day: boolean }

export const STATUS_ORDER = ['Needs attention', 'To do', 'Done', 'Ready'] as const;
export const OWNER_ORDER = ['Club', 'Sponsor loaner', 'Officer loaner'] as const;

// The shelf a row sits on, in words: a club device's shelf (the first part of "Shelf A · T1"), a loaner is not in storage, a row with no device yet has no shelf to look at.
export function shelfOf(r: Pick<GroupableRow, 'kind' | 'where' | 'located'>): string {
  if (r.kind === 'slot') return 'No device chosen yet';
  if (r.kind !== 'club') return 'Loaners (not in storage)';
  return r.located ? r.where.split(' · ')[0] : 'No shelf set';
}

// The groups a row belongs to (a row can need several games, so it can be in several groups). Station grouping is not here: it keeps empty stations, so the page does it.
export function groupTitles<T extends GroupableRow>(r: T, mode: Exclude<DeviceGroup, 'station'>, ctx: GroupCtx<T>): string[] {
  switch (mode) {
    case 'none': return ['All devices'];
    case 'type': return [r.type];
    case 'shelf': return [shelfOf(r)];
    case 'owner': return [r.kind === 'sponsor' ? 'Sponsor loaner' : r.kind === 'officer' ? 'Officer loaner' : 'Club'];
    case 'status': return [ctx.attention(r) ? 'Needs attention' : ctx.day ? (ctx.complete(r) ? 'Done' : 'To do') : 'Ready'];
    case 'games': return r.games_needed.length ? r.games_needed : ['No game needed'];
  }
}

const order = (mode: DeviceGroup, titles: string[], rank: (type: string) => number) => {
  const fixed = mode === 'status' ? STATUS_ORDER : mode === 'owner' ? OWNER_ORDER : null;
  return [...titles].sort((a, b) => {
    if (fixed) return (fixed as readonly string[]).indexOf(a) - (fixed as readonly string[]).indexOf(b);
    if (mode === 'type') return rank(a) - rank(b) || a.localeCompare(b, undefined, { numeric: true });
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  });
};

export function groupRows<T extends GroupableRow>(rows: T[], mode: Exclude<DeviceGroup, 'station'>, ctx: GroupCtx<T>, rank: (type: string) => number = () => 0): { title: string; rows: T[] }[] {
  const map = new Map<string, T[]>();
  for (const r of rows) for (const t of groupTitles(r, mode, ctx)) map.set(t, [...(map.get(t) ?? []), r]);
  return order(mode, [...map.keys()], rank).map((title) => ({ title, rows: map.get(title)! }));
}

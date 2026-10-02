// Which sections get a slot on the mobile bottom bar. The bar is Home + up to three of these + More,
// chosen by a score instead of a fixed list:
//   • a base weight (what most members reach for: tickets, rewards, profile)
//   • a boost from the server for what's relevant to this person right now (an event today, a ticket
//     for tomorrow, a role that runs events…) — see `dockBoost` in portal/page.tsx
//   • what this person actually opens on this device (frequency, fading over a couple of weeks)
//   • the time of week: Meetings jumps up while a meeting is on (the server decides — see portal/page.tsx)
// The winners are shown in the portal's normal section order, so the bar doesn't reshuffle its
// positions every time the scores shift slightly.

const BASE_WEIGHT: Record<string, number> = {
  tickets: 30, meetings: 25, 'internal-events': 8, points: 20, battlepass: 18, profile: 10, events: 12, checkin: 12, activity: 5,
};

export interface DockUsage { [sectionId: string]: { count: number; last: number } }

const USAGE_KEY = 'portal-dock-usage';
const URGENT_AT = 80;

export function readUsage(): DockUsage {
  try { return JSON.parse(localStorage.getItem(USAGE_KEY) || '{}') as DockUsage; } catch { return {}; }
}

export function recordUse(id: string): void {
  try {
    const usage = readUsage();
    const prev = usage[id];
    usage[id] = { count: Math.min((prev?.count ?? 0) + 1, 200), last: Date.now() };
    localStorage.setItem(USAGE_KEY, JSON.stringify(usage));
  } catch { /* storage blocked — the bar just stays on its defaults */ }
}

function usageScore(id: string, usage: DockUsage, now: Date): number {
  const u = usage[id];
  if (!u) return 0;
  const days = Math.max(0, (now.getTime() - u.last) / 86_400_000);
  return Math.min(40, u.count * 4 * Math.pow(0.5, days / 14));
}

interface Pickable { id: string; dockBoost?: number; dockExclude?: boolean }

export function pickDock<T extends Pickable>(sections: T[], opts: { now?: Date; usage?: DockUsage } = {}): { ids: Set<string>; urgent: Set<string>; slots: number } {
  // Sections flagged dockExclude never take a bottom-bar slot (they're still in the More sheet).
  const eligible = sections.filter((s) => !s.dockExclude);
  const slots = sections.length <= 4 ? Math.min(eligible.length, sections.length) : 3;
  const now = opts.now;
  const scored = eligible.map((s, order) => {
    const score = (BASE_WEIGHT[s.id] ?? 0) + (s.dockBoost ?? 0) + (now ? usageScore(s.id, opts.usage ?? {}, now) : 0);
    return { id: s.id, score, order };
  });
  const top = [...scored].sort((a, b) => b.score - a.score || a.order - b.order).slice(0, slots);
  return { ids: new Set(top.map((t) => t.id)), urgent: new Set(top.filter((t) => t.score - (BASE_WEIGHT[t.id] ?? 0) >= URGENT_AT).map((t) => t.id)), slots };
}

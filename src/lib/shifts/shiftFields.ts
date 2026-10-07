// Cleaning for the free-text fields of a station guide (shared by the station and per-event routes).
export const text = (v: unknown, max: number) => { const t = String(v ?? '').trim().slice(0, max); return t || null; };
/** A link must be a plain web address (nothing like javascript:). null = blank, undefined = not allowed. */
export const webUrl = (v: unknown): string | null | undefined => { const t = String(v ?? '').trim(); if (!t) return null; try { const u = new URL(t); return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString().slice(0, 500) : undefined; } catch { return undefined; } };

/** The checklist box: one item per line, trimmed, blank and repeated lines dropped, at most 30 items of 120 characters. */
export function parseChecklist(raw: string): string[] {
  return [...new Set(raw.split('\n').map((l) => l.trim().slice(0, 120)).filter(Boolean))].slice(0, 30);
}

/** When exec should be told a cover request is still open: once after 3 hours, and once more within 2 hours of the shift. Each is only ever sent once. */
export function coverAlertDue(r: { createdAt: Date; start: Date; now: Date; alerted: boolean; alertedFinal: boolean }): 'final' | 'late' | null {
  if (r.start.getTime() <= r.now.getTime()) return null;
  if (!r.alertedFinal && r.start.getTime() - r.now.getTime() <= 2 * 3600_000) return 'final';
  if (!r.alerted && r.now.getTime() - r.createdAt.getTime() >= 3 * 3600_000) return 'late';
  return null;
}

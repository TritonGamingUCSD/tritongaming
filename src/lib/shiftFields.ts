// Cleaning for the free-text fields of a station guide (shared by the station and per-event routes).
export const text = (v: unknown, max: number) => { const t = String(v ?? '').trim().slice(0, max); return t || null; };
/** A link must be a plain web address (nothing like javascript:). null = blank, undefined = not allowed. */
export const webUrl = (v: unknown): string | null | undefined => { const t = String(v ?? '').trim(); if (!t) return null; try { const u = new URL(t); return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString().slice(0, 500) : undefined; } catch { return undefined; } };

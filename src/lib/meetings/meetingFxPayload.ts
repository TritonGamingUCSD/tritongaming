// What a phone sends the meeting screen for fun: emoji reactions and wall stickers, in one small message (see meetingFx.ts). The screen checks every message with
// `cleanFx` before using it, since anything on the channel could have come from anywhere: it is only ever drawn, and counted if the emoji is one of the club's own.
import { validWallSpot } from './meetingWall';

export interface FxSticker { e: string; x: number; y: number }
export interface Fx {
  b: string;                       // this message's own id: the same message is never counted twice, however many screens heard it
  r?: Record<string, number>;      // emoji reactions: how many of each
  s?: FxSticker[];                 // wall stickers
}

export const FX_EVERY = 450;       // a phone sends what it has at most this often (ms)
export const FX_MAX = 25;          // most of one emoji in one message
export const FX_MAX_STICKERS = 8;

const int = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? Math.floor(n) : 0);

/** The message in a safe shape, or null when there is nothing usable in it. `known` says whether an emoji is one the club has. */
export function cleanFx(raw: unknown, known: (emoji: string) => boolean): Fx | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.b !== 'string' || o.b.length < 4 || o.b.length > 24) return null;
  const out: Fx = { b: o.b };
  if (o.r && typeof o.r === 'object') {
    const r: Record<string, number> = {};
    for (const [e, n] of Object.entries(o.r as Record<string, unknown>).slice(0, 12)) {
      const k = Math.min(FX_MAX, int(n));
      if (k > 0 && known(e)) r[e] = k;
    }
    if (Object.keys(r).length) out.r = r;
  }
  if (Array.isArray(o.s)) {
    const s: FxSticker[] = [];
    for (const t of o.s.slice(0, FX_MAX_STICKERS)) {
      const q = t as Partial<FxSticker> | null;
      if (q && typeof q.e === 'string' && known(q.e) && validWallSpot(q.x, q.y)) s.push({ e: q.e, x: q.x as number, y: q.y as number });
    }
    if (s.length) out.s = s;
  }
  return out.r || out.s ? out : null;
}

import { rsEncode, rsDecode } from './rs';
import { R_LOGO, R_IN, R_OUT, U, FINDER_C, SPAN, FINDERS, DOTS, R_SMALL, KEEP_OUT_FINDER, KEEP_OUT_DOT } from './marks';
export { R_LOGO, R_IN, R_OUT, U, FINDER_C, SPAN, FINDERS, DOTS, R_SMALL };

// The first format (before 2026-10-19): kept so a code drawn by a page that has not reloaded still scans. See layout.ts for the current one.

// The portal's own circular code (what a ticket, a meeting's check-in and a reward pickup show). Only the portal's Scan button reads it; a phone camera sees a pattern.
// Geometry is in "code units": the plate is a circle of radius 1 around (0,0), x to the right, y down (as on screen).
//   • two ring marks at the top-left and top-right (concentric rings, 1:1:3:1:1 across, the same as a QR's finder so every direction reads alike), and a small
//     solid dot at each bottom corner: the ring marks say which way is up, and all four straighten a code seen at an angle
//   • a disc of concentric rings of dashes (the look of Apple's App Clip codes): RINGS rings of SECTORS cells, each cell a dash or a gap. 32 bytes of it are the message (8 of payload and 24 of Reed–Solomon
//     repair), scattered over the cells; the cells left over (and none under the marks) are filled with look-alike dashes the reader ignores
//   • a solid disc with the Triton logo in the middle (not read)
export const RINGS = 8;
export const SECTORS = 56;
export const NSYM = 24;
export const TOTAL_BYTES = 32;
export const DATA_BYTES = TOTAL_BYTES - NSYM; // 8: kind, 6 token bytes, a check byte
export const BITS = TOTAL_BYTES * 8; // 256
export const THICK = 0.07;
export const DASH = 0.042; // width of an arc dash (a ring is THICK across, so rings stay clearly apart)

export type Kind = 'm' | 't' | 'r'; // meeting check-in, event ticket, reward pickup
const KIND_BYTE: Record<Kind, number> = { m: 1, t: 2, r: 3 };
const KIND_OF = ['', 'm', 't', 'r'] as const;
export const PAYLOAD = /^[mtr][0-9a-f]{12}$/;

export const cellAngle = (sector: number) => ((sector + 0.5) * 2 * Math.PI) / SECTORS;
export const cellRadius = (ring: number) => R_IN + (ring + 0.5) * THICK;
export const cellCenter = (ring: number, sector: number) => ({ x: cellRadius(ring) * Math.cos(cellAngle(sector)), y: cellRadius(ring) * Math.sin(cellAngle(sector)) });

// Cells under a mark carry nothing. The rest are dealt out by a fixed shuffle: the first BITS of them hold the message, the others are filler.
const underMark = (ring: number, sector: number) => {
  const c = cellCenter(ring, sector);
  return Object.values(FINDERS).some((f) => Math.hypot(c.x - f.x, c.y - f.y) < KEEP_OUT_FINDER) || Object.values(DOTS).some((d) => Math.hypot(c.x - d.x, c.y - d.y) < KEEP_OUT_DOT);
};
const ORDER: [number, number][] = (() => {
  const active: [number, number][] = [];
  for (let r = 0; r < RINGS; r++) for (let s = 0; s < SECTORS; s++) if (!underMark(r, s)) active.push([r, s]);
  if (active.length < BITS) throw new Error(`TGcode layout has only ${active.length} cells`);
  // A deterministic shuffle (a seeded Fisher–Yates), so neighbouring cells hold bits far apart in the message.
  let seed = 0x2f6b1;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x80000000;
  };
  for (let i = active.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [active[i], active[j]] = [active[j], active[i]];
  }
  return active;
})();
export const DATA_CELLS = ORDER.slice(0, BITS);
const FILL_CELLS = ORDER.slice(BITS);
const FILL_AT = new Set(FILL_CELLS.map(([r, s]) => r * SECTORS + s));
export const isFill = (ring: number, sector: number) => FILL_AT.has(ring * SECTORS + sector);

const crc8 = (bytes: number[]) => {
  let c = 0;
  for (const b of bytes) {
    c ^= b;
    for (let i = 0; i < 8; i++) c = c & 0x80 ? ((c << 1) ^ 0x07) & 0xff : (c << 1) & 0xff;
  }
  return c;
};
const MASK = (() => {
  const m: number[] = [];
  let s = 0x5a3c;
  for (let i = 0; i < BITS; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    m.push((s >> 16) & 1);
  }
  return m;
})();

function codeword(payload: string): number[] | null {
  if (!PAYLOAD.test(payload)) return null;
  const data = [KIND_BYTE[payload[0] as Kind]];
  for (let i = 0; i < 6; i++) data.push(parseInt(payload.slice(1 + i * 2, 3 + i * 2), 16));
  data.push(crc8(data));
  const code = rsEncode(data, NSYM);
  const bits: number[] = [];
  for (const b of code) for (let i = 7; i >= 0; i--) bits.push((b >> i) & 1);
  return bits.map((b, i) => b ^ MASK[i]);
}

/** Which cells are dashes: [ring][sector], message cells and filler together (null for a payload that is not valid). `isFill` says which cells are filler. */
export function dashGrid(payload: string): boolean[][] | null {
  const bits = codeword(payload);
  if (!bits) return null;
  const grid = Array.from({ length: RINGS }, () => new Array<boolean>(SECTORS).fill(false));
  DATA_CELLS.forEach(([r, s], i) => {
    grid[r][s] = bits[i] === 1;
  });
  FILL_CELLS.forEach(([r, s], k) => {
    grid[r][s] = (bits[(k * 7 + 3) % BITS] ^ bits[(k * 13 + 5) % BITS]) === 1;
  });
  return grid;
}

/** What the message cells say (in the order DATA_CELLS lists them), or null when the repair cannot make the check come out. */
export function payloadFromBits(masked: number[]): string | null {
  const bytes: number[] = [];
  for (let i = 0; i < BITS; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | (masked[i + j] ^ MASK[i + j]);
    bytes.push(b);
  }
  const data = rsDecode(bytes, NSYM);
  if (!data || data.length !== DATA_BYTES) return null;
  if (crc8(data.slice(0, 7)) !== data[7]) return null;
  const kind = KIND_OF[data[0]];
  if (!kind) return null;
  return (
    kind +
    data
      .slice(1, 7)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  );
}

/** The message bits as the cells show them (for tests). */
export function messageBits(payload: string): number[] | null {
  return codeword(payload);
}

/** Arc dashes to draw: in each ring, runs of consecutive dash cells of one kind: [ring, firstSector, lastSector, fill] (a run that crosses the top stays one dash, with lastSector past SECTORS − 1). The message dashes and the filler dashes are drawn in different colours; the reader only ever looks at the message cells. */
export function dashRuns(payload: string): [number, number, number, boolean][] {
  const grid = dashGrid(payload);
  if (!grid) return [];
  const runs: [number, number, number, boolean][] = [];
  const same = (r: number, a: number, b: number) => grid[r][b] && isFill(r, a) === isFill(r, b);
  for (let r = 0; r < RINGS; r++) {
    // Start where a dash cannot continue from the one before, so a run crossing sector 0 is kept whole.
    let start = -1;
    for (let s = 0; s < SECTORS; s++)
      if (!(grid[r][s] && grid[r][(s + SECTORS - 1) % SECTORS] && isFill(r, s) === isFill(r, (s + SECTORS - 1) % SECTORS))) {
        start = s;
        break;
      }
    if (start < 0) {
      runs.push([r, 0, SECTORS - 1, isFill(r, 0)]);
      continue;
    }
    let i = 0;
    while (i < SECTORS) {
      const s = (start + i) % SECTORS;
      if (!grid[r][s]) {
        i++;
        continue;
      }
      let n = 1;
      while (i + n < SECTORS && same(r, s, (start + i + n) % SECTORS)) n++;
      runs.push([r, s, s + n - 1, isFill(r, s)]);
      i += n;
    }
  }
  return runs;
}

/** How far, in cells, a dash is drawn past (or short of) a cell edge where an arc starts (which = 0) or ends (which = 1): a small fixed amount that differs from arc to arc, so the arcs are not all one length.
 *  The reader looks at the middle of each cell, so these stay small (0, 0.1 or 0.2 of a cell past). */
export function endShift(ring: number, sector: number, which: 0 | 1): number {
  let h = (ring * 131 + (sector % SECTORS) * 31 + which * 17 + 7) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 3266489917) >>> 0;
  h ^= h >>> 16;
  return Math.floor(3 * ((h >>> 0) / 4294967296)) * 0.1; // one of three set lengths: 0, 0.1 or 0.2 of a cell
}

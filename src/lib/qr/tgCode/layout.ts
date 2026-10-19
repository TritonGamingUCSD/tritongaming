import { rsEncode, rsDecode } from './rs';
import { R_LOGO, R_IN, R_OUT, U, FINDER_C, SPAN, FINDERS, DOTS, R_SMALL, KEEP_OUT_FINDER, KEEP_OUT_DOT } from './marks';
export { R_LOGO, R_IN, R_OUT, U, FINDER_C, SPAN, FINDERS, DOTS, R_SMALL };

// The portal's own circular code (what a ticket, a meeting's check-in and a reward pickup show). Only the portal's Scan button reads it; a phone camera sees a pattern.
// Geometry is in "code units" (see marks.ts). Inside the marks sits a disc of concentric rings of cells, each cell an arc or a gap, built to be read from far away:
//   • every cell is about as wide as it is tall (the rings have fewer cells nearer the middle), so the smallest cell is as big as it can be
//   • the message is written as arcs with a gap of exactly ONE cell between them (never two gaps in a row, so the gaps are all alike) and no arc shorter than two cells
//     (no tiny dashes). A block of 10 cells starts with an arc and holds one of 16 patterns of such arcs, which is 4 bits; two blocks make a byte. A wrong cell therefore
//     spoils one block and one byte
//   • 5 bytes of message (what it is, and 32 bits of the key the server checks) followed by 9 bytes of Reed–Solomon repair, scattered over the disc by a fixed shuffle.
//     The reader weighs every block (how sure it is of the pattern), hands the shaky ones to the repair as "known unreliable", and so can mend more than it could blind
//   • the cells left over after the blocks (and none under the marks) are never read; where one fits, a filler arc is drawn there in the brand's other colours
export const RINGS = 7;
export const SECTORS = [34, 42, 50, 57, 65, 73, 81] as const;   // cells in each ring, from the inside
export const THICK = (R_OUT - R_IN) / RINGS;                    // 0.08
export const DASH = 0.056;                                      // width of an arc (a ring is THICK across, so rings stay clearly apart)
export const BLOCK = 10;                                        // cells in a block: an arc, then a pattern of arcs of two or more cells with one gap between them
export const NSYM = 9;                                          // repair bytes
export const DATA_BYTES = 5;                                    // version and kind, then the 4 bytes of key
export const TOTAL_BYTES = DATA_BYTES + NSYM;                   // 14
export const NIBBLES = TOTAL_BYTES * 2;                         // 28 blocks
export const KEY_HEX = 8;                                       // hex digits of key in a code (32 bits)
const VERSION = 2;

/** What the page hands the drawing: a kind letter and the first 12 hex digits of a key. The code carries the first KEY_HEX of them; the server accepts that many. */
export const PAYLOAD = /^[mtr][0-9a-f]{12}$/;
export type Kind = 'm' | 't' | 'r';   // meeting check-in, event ticket, reward pickup
const KIND_BYTE: Record<Kind, number> = { m: 1, t: 2, r: 3 };
const KIND_OF = ['', 'm', 't', 'r'] as const;

export const cellAngle = (ring: number, sector: number) => ((sector + 0.5) * 2 * Math.PI) / SECTORS[ring];
export const cellRadius = (ring: number) => R_IN + (ring + 0.5) * THICK;
export const cellCenter = (ring: number, sector: number) => ({ x: cellRadius(ring) * Math.cos(cellAngle(ring, sector)), y: cellRadius(ring) * Math.sin(cellAngle(ring, sector)) });

/** Distance from a cell's middle to the edge of the nearest mark's no-go zone (negative: the cell is under a mark and carries nothing). */
export const markClearance = (ring: number, sector: number) => {
  const c = cellCenter(ring, sector);
  return Math.min(
    ...Object.values(FINDERS).map((f) => Math.hypot(c.x - f.x, c.y - f.y) - KEEP_OUT_FINDER),
    ...Object.values(DOTS).map((d) => Math.hypot(c.x - d.x, c.y - d.y) - KEEP_OUT_DOT),
  );
};

// The patterns of a block: it starts with an arc, there is one cell of gap between arcs, and no arc is shorter than two cells. 22 exist; these 16 are the ones least like one another.
const PATTERNS = ['1101101110', '1101101111', '1101110110', '1101110111', '1101111011', '1101111110', '1110110110', '1110110111', '1110111011', '1110111110', '1111011011', '1111011110', '1111011111', '1111101110', '1111101111', '1111110110'];
const PATTERN_BITS = PATTERNS.map((p) => [...p].map((c) => (c === '1' ? 1 : 0)));
export const PATTERN_COUNT = PATTERNS.length;
export const patternCells = (nibble: number): number[] => PATTERN_BITS[nibble];

// Where the blocks go: in every ring, each stretch of cells between marks is cut into blocks from its start; what is left of a stretch is a tail.
type Cell = [number, number];
const ALL_BLOCKS: Cell[][] = [];
// What is left of a stretch after its blocks (fewer than a block's cells) is a "tail": nothing is read there, and it may be drawn as one filler arc in the brand's other colours.
interface Tail { ring: number; cells: number[]; last: Cell[] | null; nextIsArc: boolean }
const TAILS: Tail[] = [];
for (let ring = 0; ring < RINGS; ring++) {
  const S = SECTORS[ring];
  const free = Array.from({ length: S }, (_, s) => markClearance(ring, s) > 0);
  const first = free.findIndex((v) => !v);
  const cyclic = first < 0;   // no mark reaches this ring: its one stretch goes all the way round
  const flush = (run: number[], startsAfterBlock: boolean) => {
    void startsAfterBlock;
    const n = Math.floor(run.length / BLOCK);
    let last: Cell[] | null = null;
    for (let b = 0; b < n; b++) { last = run.slice(b * BLOCK, (b + 1) * BLOCK).map((s) => [ring, s] as Cell); ALL_BLOCKS.push(last); }
    const cells = run.slice(n * BLOCK);
    if (cells.length) TAILS.push({ ring, cells, last, nextIsArc: cyclic && n > 0 });
  };
  if (cyclic) { flush(Array.from({ length: S }, (_, s) => s), false); continue; }
  let run: number[] = [];
  for (let k = 1; k <= S; k++) {
    const s = (first + k) % S;
    if (free[s]) run.push(s); else { flush(run, false); run = []; }
  }
}
if (ALL_BLOCKS.length < NIBBLES) throw new Error(`TGcode layout has room for only ${ALL_BLOCKS.length} blocks`);
{
  // A deterministic shuffle (a seeded Fisher–Yates), so neighbouring blocks hold bytes far apart in the message; blocks beyond what the message needs stay empty.
  let seed = 0x51ad3;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x80000000; };
  for (let i = ALL_BLOCKS.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [ALL_BLOCKS[i], ALL_BLOCKS[j]] = [ALL_BLOCKS[j], ALL_BLOCKS[i]]; }
  ALL_BLOCKS.splice(NIBBLES);
}
/** The cells of block i (the i-th half-byte of the coded message), in reading order. */
export const BLOCKS: readonly Cell[][] = ALL_BLOCKS;
const FILL_AT = new Set<number>();
for (const t of TAILS) for (const s of t.cells) FILL_AT.add(t.ring * 100 + s);
/** Whether a cell is part of a tail (never read; drawn, when it fits, as a filler arc). */
export const isTail = (ring: number, sector: number) => FILL_AT.has(ring * 100 + sector);

const MASK = (() => { const m: number[] = []; let s = 0x5a3c; for (let i = 0; i < TOTAL_BYTES; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; m.push((s >> 16) & 0xff); } return m; })();

/** The coded, masked message as half-bytes (null for a payload that is not valid). */
export function nibblesOf(payload: string): number[] | null {
  if (!PAYLOAD.test(payload)) return null;
  const data = [(VERSION << 4) | KIND_BYTE[payload[0] as Kind]];
  for (let i = 0; i < KEY_HEX / 2; i++) data.push(parseInt(payload.slice(1 + i * 2, 3 + i * 2), 16));
  const code = rsEncode(data, NSYM).map((b, i) => b ^ MASK[i]);
  return code.flatMap((b) => [b >> 4, b & 15]);
}

/** Which cells are arcs: [ring][sector] (null for a payload that is not valid). */
export function dashGrid(payload: string): boolean[][] | null {
  const nib = nibblesOf(payload);
  if (!nib) return null;
  const grid = SECTORS.map((S) => new Array<boolean>(S).fill(false));
  nib.forEach((n, i) => BLOCKS[i].forEach(([r, s], k) => { grid[r][s] = PATTERN_BITS[n][k] === 1; }));
  // A tail gets one filler arc if it can have one of two cells or more with a gap of one cell from the arcs beside it.
  for (const t of TAILS) {
    const idx = t.last ? BLOCKS.indexOf(t.last) : -1;
    const lastBit = idx >= 0 ? PATTERN_BITS[nib[idx]][BLOCK - 1] : 0;
    const lead = lastBit ? 1 : 0, trail = t.nextIsArc ? 1 : 0, len = t.cells.length - lead - trail;
    if (len >= 2) for (let k = 0; k < len; k++) grid[t.ring][t.cells[lead + k]] = true;
  }
  return grid;
}

/** What the half-bytes say (with the ones the reader doubts listed in `doubtful`, by block number), or null when the repair cannot make the checks come out. */
export function payloadFromNibbles(nib: number[], doubtful: number[] = []): string | null {
  if (nib.length !== NIBBLES) return null;
  const bytes = Array.from({ length: TOTAL_BYTES }, (_, i) => ((nib[2 * i] << 4) | nib[2 * i + 1]) ^ MASK[i]);
  const erase = [...new Set(doubtful.map((b) => b >> 1))];
  const data = rsDecode(bytes, NSYM, erase);
  if (!data || data.length !== DATA_BYTES) return null;
  if (data[0] >> 4 !== VERSION) return null;
  const kind = KIND_OF[data[0] & 15];
  if (!kind) return null;
  return kind + data.slice(1).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** The arcs to draw: in each ring, runs of consecutive arc cells: [ring, firstSector, lastSector, filler] (a run that crosses the top stays one arc, with lastSector past the ring's last sector). */
export function dashRuns(payload: string): [number, number, number, boolean][] {
  const grid = dashGrid(payload);
  if (!grid) return [];
  const runs: [number, number, number, boolean][] = [];
  for (let r = 0; r < RINGS; r++) {
    const S = SECTORS[r];
    const same = (a: number, b: number) => grid[r][b] && isTail(r, a) === isTail(r, b);
    // Start where an arc cannot continue from the cell before, so a run crossing sector 0 is kept whole.
    let start = -1;
    for (let s = 0; s < S; s++) if (!(grid[r][s] && same(s, (s + S - 1) % S))) { start = s; break; }
    if (start < 0) { runs.push([r, 0, S - 1, isTail(r, 0)]); continue; }
    let i = 0;
    while (i < S) {
      const s = (start + i) % S;
      if (!grid[r][s]) { i++; continue; }
      let n = 1;
      while (i + n < S && same(s, (start + i + n) % S)) n++;
      runs.push([r, s, s + n - 1, isTail(r, s)]);
      i += n;
    }
  }
  return runs;
}

export const EXT = -0.05;    // how far, in cells, an arc is drawn into the gap beside it (negative: short of its cell edge). A gap is one cell, so what shows is 1 − 2·EXT = 1.1 cells, the same everywhere
/** An arc as drawn: its ring, and where it starts and ends (radians, a1 past a0; a1 − a0 ≥ 2π for a ring that is one arc all the way round). */
export interface Arc { ring: number; a0: number; a1: number; fill: boolean }
export function arcs(payload: string): Arc[] {
  return dashRuns(payload).map(([ring, s, e, fill]) => {
    const S = SECTORS[ring], delta = (2 * Math.PI) / S;
    if (e - s + 1 >= S) return { ring, a0: 0, a1: 2 * Math.PI, fill };
    return { ring, a0: (s - EXT) * delta, a1: (e + 1 + EXT) * delta, fill };
  });
}

/** The fine lines of colour in the space between each pair of rings: line k (1 … RINGS − 1) runs at the edge between ring k − 1 and ring k, and stops short of the marks, so it never joins one
 *  (the reader finds the marks as separate blobs). Pieces are [k, start, end] in radians. */
export function hairlines(): [number, number, number][] {
  const TAU = 2 * Math.PI, out: [number, number, number][] = [];
  const marks = [...Object.values(FINDERS).map((f) => ({ x: f.x, y: f.y, m: 3.5 * U + 0.045 })), ...Object.values(DOTS).map((d) => ({ x: d.x, y: d.y, m: R_SMALL + 0.05 }))];
  for (let k = 1; k < RINGS; k++) {
    const r = R_IN + k * THICK;
    const cut: [number, number][] = [];
    for (const { x, y, m } of marks) {
      const d = Math.hypot(x, y);
      if (Math.abs(r - d) >= m) continue;
      const half = Math.acos(Math.max(-1, Math.min(1, (r * r + d * d - m * m) / (2 * r * d)))), a = Math.atan2(y, x);
      const lo = (((a - half) % TAU) + TAU) % TAU, hi = lo + 2 * half;
      if (hi > TAU) { cut.push([lo, TAU], [0, hi - TAU]); } else cut.push([lo, hi]);
    }
    cut.sort((p, q) => p[0] - q[0]);
    let at = 0;
    for (const [lo, hi] of cut) { if (lo > at + 1e-6) out.push([k, at, lo]); at = Math.max(at, hi); }
    if (at < TAU - 1e-6) out.push([k, at, TAU]);
  }
  return out;
}

import { rsEncode, rsDecode } from '../tgCode/rs';
import { FINDERS, SPAN, KEEP_OUT_FINDER } from './marks';
import { STROKES, DOTS_OF_INK } from './byteArt';
export { FINDERS, SPAN };

// The Bytecode: the same message as the portal's circular TGcode (what a ticket, a meeting's check-in and a reward pickup show; see lib/qr/tgCode), written into Byte, the Triton
// Gaming mascot, instead of in rings. Only the portal's Scan button reads it. The rules are the TGcode's, with "stretches" in place of rings:
//   • a stretch is a run of cells along one of his drawn lines (the outline, the sticker border round him, the
//     scarf's edge, the wing feathers…) cut into cells of equal length. A cell is a bar (the line is drawn there) or a gap (it is not: the colour beside it shows through)
//   • the message is written as bars with a gap of exactly ONE cell between them and no bar shorter than two cells. A block of 10 cells starts with a bar and holds one of 16
//     patterns of such bars, which is 4 bits; two blocks make a byte. A wrong cell therefore spoils one block and one byte
//   • 4 bytes of message (what it is, a mark that says it is a Bytecode, and 28 bits of the key the server checks) followed by Reed–Solomon repair bytes, scattered over Byte by a fixed shuffle (its own, so a
//     Bytecode is never mistaken for a TGcode: the version in the first byte is 3 here, 2 there)
//   • lines and cells that are not part of the message are drawn as Byte is, so what carries it is only a few pieces of his drawing turned into dashes
export const PITCH = 0.032; // the length of a cell along a line
export const LINE_W = 0.026; // how thick his drawn lines are
export const BLOCK = 10;
export const NSYM = 9; // repair bytes (the same as the TGcode)
export const DATA_BYTES = 4; // kind (2 bits), version mark (2 bits) and 28 bits of key
export const TOTAL_BYTES = DATA_BYTES + NSYM; // 13
export const NIBBLES = TOTAL_BYTES * 2; // 26 blocks
export const KEY_HEX = 7; // hex digits of key in a code (28 bits; the TGcode carries 8)
const VERSION = 3; // the 2-bit mark that says this is a Bytecode
const CLEAR_LINE = 0.034; // how far a cell on a line stays from any other line

export const PAYLOAD = /^[mtr][0-9a-f]{12}$/;
export type Kind = 'm' | 't' | 'r';
const KIND_BYTE: Record<Kind, number> = { m: 1, t: 2, r: 3 };
const KIND_OF = ['', 'm', 't', 'r'] as const;

type Pt = [number, number];
const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const segDist = (p: Pt, a: Pt, b: Pt) => {
  const vx = b[0] - a[0],
    vy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / (vx * vx + vy * vy || 1)));
  return Math.hypot(p[0] - a[0] - t * vx, p[1] - a[1] - t * vy);
};

// Each stroke with its cumulative length, so a cell can be placed by distance along it.
interface Line {
  pts: Pt[];
  at: number[]; // distance along the stroke at each point
  length: number;
}
const LINES: Line[] = STROKES.map((s) => {
  const at = [0];
  for (let i = 1; i < s.pts.length; i++) at.push(at[i - 1] + dist(s.pts[i], s.pts[i - 1]));
  return { pts: s.pts, at, length: at[at.length - 1] };
});
const pointAt = (L: Line, s: number): Pt => {
  let i = 1;
  while (i < L.at.length - 1 && L.at[i] < s) i++;
  const t = (s - L.at[i - 1]) / (L.at[i] - L.at[i - 1] || 1);
  return [L.pts[i - 1][0] + (L.pts[i][0] - L.pts[i - 1][0]) * t, L.pts[i - 1][1] + (L.pts[i][1] - L.pts[i - 1][1]) * t];
};
/** The part of a stroke between two distances along it, as a polyline. */
export function sliceLine(index: number, s0: number, s1: number): Pt[] {
  const L = LINES[index];
  const a = Math.max(0, s0),
    b = Math.min(L.length, s1);
  const out: Pt[] = [pointAt(L, a)];
  for (let i = 0; i < L.pts.length; i++) if (L.at[i] > a && L.at[i] < b) out.push(L.pts[i]);
  out.push(pointAt(L, b));
  return out;
}
const lineDist = (p: Pt, L: Line) => {
  let m = Infinity;
  for (let i = 1; i < L.pts.length; i++) m = Math.min(m, segDist(p, L.pts[i - 1], L.pts[i]));
  return m;
};
const clearOfLines = (p: Pt, skip: number, clear: number) => {
  for (let i = 0; i < LINES.length; i++) if (i !== skip && lineDist(p, LINES[i]) < clear) return false;
  for (const d of DOTS_OF_INK) if (Math.hypot(p[0] - d.x, p[1] - d.y) < d.r + clear) return false;
  return true;
};
const clearOfMarks = (p: Pt) => {
  for (const f of Object.values(FINDERS)) if (Math.hypot(p[0] - f.x, p[1] - f.y) < KEEP_OUT_FINDER) return false;
  return true;
};

/** A run of cells in a line. `stroke` is the index of the drawn line it lies along (-1: a row across a flat area) and `s0` the distance along it at which its first cell starts. */
export interface Stretch {
  cells: Pt[];
  stroke: number;
  s0: number;
}
export const STRETCHES: Stretch[] = [];
{
  // along the lines that may carry data
  STROKES.forEach((st, index) => {
    if (!st.ok) return;
    const L = LINES[index];
    const n = Math.floor(L.length / PITCH);
    let run: Pt[] = [],
      first = 0;
    const flush = () => {
      if (run.length >= BLOCK) STRETCHES.push({ cells: run, stroke: index, s0: first * PITCH });
      run = [];
    };
    for (let k = 0; k < n; k++) {
      const p = pointAt(L, (k + 0.5) * PITCH);
      if (clearOfMarks(p) && clearOfLines(p, index, CLEAR_LINE)) {
        if (!run.length) first = k;
        run.push(p);
      } else flush();
    }
    flush();
  });
}
export const RINGS = STRETCHES.length;

const PATTERNS = [
  '1101101110',
  '1101101111',
  '1101110110',
  '1101110111',
  '1101111011',
  '1101111110',
  '1110110110',
  '1110110111',
  '1110111011',
  '1110111110',
  '1111011011',
  '1111011110',
  '1111011111',
  '1111101110',
  '1111101111',
  '1111110110',
];
const PATTERN_BITS = PATTERNS.map((p) => [...p].map((c) => (c === '1' ? 1 : 0)));
export const PATTERN_COUNT = PATTERNS.length;
export const patternCells = (nibble: number): number[] => PATTERN_BITS[nibble];

/** The middle of a cell: [stretch, number in the stretch]. */
export const cellCenter = (stretch: number, index: number) => ({ x: STRETCHES[stretch].cells[index][0], y: STRETCHES[stretch].cells[index][1] });

// Where the blocks go: every stretch is cut into blocks, centred in it.
type Cell = [number, number];
const ALL_BLOCKS: Cell[][] = [];
STRETCHES.forEach((st, si) => {
  const n = Math.floor(st.cells.length / BLOCK),
    from = Math.floor((st.cells.length - n * BLOCK) / 2);
  for (let b = 0; b < n; b++) ALL_BLOCKS.push(Array.from({ length: BLOCK }, (_, k) => [si, from + b * BLOCK + k] as Cell));
});
export const BLOCKS_AVAILABLE = ALL_BLOCKS.length;
if (ALL_BLOCKS.length < NIBBLES) throw new Error(`Bytecode layout has room for only ${ALL_BLOCKS.length} blocks`);
{
  // A deterministic shuffle (a seeded Fisher–Yates), so neighbouring blocks hold bytes far apart in the message; blocks beyond what the message needs stay empty.
  let seed = 0x7b17e;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x80000000;
  };
  for (let i = ALL_BLOCKS.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [ALL_BLOCKS[i], ALL_BLOCKS[j]] = [ALL_BLOCKS[j], ALL_BLOCKS[i]];
  }
}
/** The cells of block i (the i-th half-byte of the coded message), in reading order; blocks beyond what the message needs stay as Byte is drawn. */
export const BLOCKS: readonly Cell[][] = ALL_BLOCKS.slice(0, NIBBLES);

const MASK = (() => {
  const m: number[] = [];
  let s = 0x3c5a;
  for (let i = 0; i < TOTAL_BYTES; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    m.push((s >> 16) & 0xff);
  }
  return m;
})();

/** The coded, masked message as half-bytes (null for a payload that is not valid). A payload is what the page hands the drawing: a kind letter and 12 hex digits of key; the code carries the first 7. */
export function nibblesOf(payload: string): number[] | null {
  if (!PAYLOAD.test(payload)) return null;
  const data = [(KIND_BYTE[payload[0] as Kind] << 6) | (VERSION << 4) | parseInt(payload[1], 16)];
  for (let i = 0; i < 3; i++) data.push(parseInt(payload.slice(2 + i * 2, 4 + i * 2), 16));
  const code = rsEncode(data, NSYM).map((b, i) => b ^ MASK[i]);
  return code.flatMap((b) => [b >> 4, b & 15]);
}

/** Which cells are bars: [stretch][cell] (null for a payload that is not valid). Cells outside the message's blocks are false (and are drawn as Byte is). */
export function dashGrid(payload: string): boolean[][] | null {
  const nib = nibblesOf(payload);
  if (!nib) return null;
  const grid = STRETCHES.map((st) => new Array<boolean>(st.cells.length).fill(false));
  nib.forEach((n, i) =>
    BLOCKS[i].forEach(([r, c], k) => {
      grid[r][c] = PATTERN_BITS[n][k] === 1;
    }),
  );
  return grid;
}

/** What the half-bytes say (with the ones the reader doubts listed in `doubtful`, by block number), or null when the repair cannot make the checks come out. */
export function payloadFromNibbles(nib: number[], doubtful: number[] = []): string | null {
  if (nib.length !== NIBBLES) return null;
  const bytes = Array.from({ length: TOTAL_BYTES }, (_, i) => ((nib[2 * i] << 4) | nib[2 * i + 1]) ^ MASK[i]);
  const erase = [...new Set(doubtful.map((b) => b >> 1))];
  const data = rsDecode(bytes, NSYM, erase);
  if (!data || data.length !== DATA_BYTES) return null;
  if (((data[0] >> 4) & 3) !== VERSION) return null;
  const kind = KIND_OF[data[0] >> 6];
  if (!kind) return null;
  return (
    kind +
    (data[0] & 15).toString(16) +
    data
      .slice(1)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  );
}

export const EXT = -0.05; // how far, in cells, a bar is drawn into the gap beside it (negative: short of its cell edge)

/** What to draw for a message, as polylines (each a list of points). The outer lines (his outline and the sticker border round him) are the ones that may carry the message: `lineBars` are
 *  their dashes and `edge` what is left of them as ordinary line; `inner` are his other lines, drawn as they are. (They are separate so the outer ones can change colour on a dark screen.) */
export function drawing(payload: string): { lineBars: Pt[][]; edge: Pt[][]; inner: Pt[][] } | null {
  const grid = dashGrid(payload);
  if (!grid) return null;
  const lineBars: Pt[][] = [];
  const spent: [number, number][][] = LINES.map(() => []); // the stretch of each line taken by message blocks
  BLOCKS.forEach((block) => {
    const si = block[0][0];
    const st = STRETCHES[si];
    spent[st.stroke].push([st.s0 + block[0][1] * PITCH, st.s0 + (block[BLOCK - 1][1] + 1) * PITCH]);
  });
  STRETCHES.forEach((st, si) => {
    const row = grid[si];
    let c = 0;
    while (c < row.length) {
      if (!row[c]) {
        c++;
        continue;
      }
      let n = 1;
      while (c + n < row.length && row[c + n]) n++;
      const a = st.s0 + (c - EXT) * PITCH + LINE_W / 2,
        b = st.s0 + (c + n + EXT) * PITCH - LINE_W / 2;
      lineBars.push(sliceLine(st.stroke, a, b));
      c += n;
    }
  });
  // the rest of each line, with the message's blocks cut out of it
  const edge: Pt[][] = [],
    inner: Pt[][] = [];
  LINES.forEach((L, i) => {
    const out = STROKES[i].ok ? edge : inner;
    const cuts = spent[i].sort((p, q) => p[0] - q[0]);
    let from = 0;
    for (const [a, b] of cuts) {
      if (a > from + 1e-6) out.push(sliceLine(i, from, a));
      from = Math.max(from, b);
    }
    if (L.length > from + 1e-6) out.push(sliceLine(i, from, L.length));
  });
  return { lineBars, edge, inner };
}

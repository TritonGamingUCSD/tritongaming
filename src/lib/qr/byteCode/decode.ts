import { BLOCKS, BLOCK, RINGS, PATTERN_COUNT, patternCells, cellCenter, dashGrid, payloadFromNibbles, DOTS, FINDERS, R_SMALL } from './layout';
import { type Finder, findDots, homography, binarize } from '../tgCode/find';
import { findEyes } from './eyes';

// Reads a Bytecode out of a camera picture (grey values, width × height). No library: it finds Byte's two eyes (a pale pill and a pale X on his green head), works out where the code
// sits (position, size, turn and tilt, with the two bottom dots), and looks at the middle of every cell. A cell is not simply called "dash" or "gap": each block of 7
// cells is compared with the 16 arcs it could be and given a score for how clearly it is one of them. The doubtful blocks are handed to the Reed–Solomon repair as
// known-unreliable (cheap to mend), and a result only counts when the repair succeeds, the version and kind are right, and the cells it implies match what the picture
// showed.

/** Where a Bytecode was found in the picture: its centre and radius, in picture pixels. */
export interface ByteSpot {
  x: number;
  y: number;
  r: number;
}

type Mapper = (x: number, y: number) => { x: number; y: number };

/** Three points fix a turn, a scale and a shear, which is most of a tilt: the map from code units that takes the two top marks and one more point to where they are in the picture. */
function affineMap(L: Finder, R: Finder, d: { x: number; y: number }, got: { x: number; y: number }): Mapper | null {
  const ax = FINDERS.tr.x - FINDERS.tl.x,
    ay = FINDERS.tr.y - FINDERS.tl.y,
    bx = d.x - FINDERS.tl.x,
    by = d.y - FINDERS.tl.y;
  const det = ax * by - ay * bx;
  if (Math.abs(det) < 1e-9) return null;
  const px = R.x - L.x,
    py = R.y - L.y,
    qx = got.x - L.x,
    qy = got.y - L.y;
  const m00 = (px * by - qx * ay) / det,
    m01 = (qx * ax - px * bx) / det,
    m10 = (py * by - qy * ay) / det,
    m11 = (qy * ax - py * bx) / det;
  return (x, y) => {
    const fx = x - FINDERS.tl.x,
      fy = y - FINDERS.tl.y;
    return { x: L.x + m00 * fx + m01 * fy, y: L.y + m10 * fx + m11 * fy };
  };
}

type Pt = { x: number; y: number };

/** One way the picture could be laid over the code: the grey level at the middle of every cell of every block, the levels of the marks and of the plate, and the map. They come
 *  likeliest first (a tilted code can have its bottom dots mistaken, so a few ways are tried until one of them reads). */
function* hypotheses(
  gray: Uint8ClampedArray | Uint8Array,
  w: number,
  h: number,
  L: Finder,
  R: Finder,
  bin: Uint8Array,
  straighten: boolean,
): Generator<{ values: number[][]; mark: number; plate: number; map: Mapper }> {
  // Code units → picture as a turn and a scale fixed by the two marks.
  const vx = FINDERS.tr.x - FINDERS.tl.x,
    vy = FINDERS.tr.y - FINDERS.tl.y,
    v2 = vx * vx + vy * vy;
  const dx = ((R.x - L.x) * vx + (R.y - L.y) * vy) / v2, // the picture's vector between the eyes divided by the code's, as complex numbers: a turn and a scale
    dy = ((R.y - L.y) * vx - (R.x - L.x) * vy) / v2;
  const similar: Mapper = (x, y) => {
    const fx = x - FINDERS.tl.x,
      fy = y - FINDERS.tl.y;
    return { x: L.x + fx * dx - fy * dy, y: L.y + fx * dy + fy * dx };
  };
  const scale = Math.hypot(dx, dy); // pixels per code unit
  // Bilinear, so a cell that falls between pixels (a small code) is not read from whichever pixel it happens to round to.
  const grabWith = (map: Mapper) => (x: number, y: number) => {
    const p = map(x, y);
    if (p.x < 1 || p.y < 1 || p.x >= w - 2 || p.y >= h - 2) return -1;
    const x0 = Math.floor(p.x),
      y0 = Math.floor(p.y),
      fx = p.x - x0,
      fy = p.y - y0;
    const a = gray[y0 * w + x0],
      b = gray[y0 * w + x0 + 1],
      c = gray[(y0 + 1) * w + x0],
      d = gray[(y0 + 1) * w + x0 + 1];
    return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy;
  };
  // Reference levels from the picture of the code itself: his lines are the darkest thing on him and his pale parts the lightest, so the dark and light ends of the grey levels
  // found over his body (a coarse look at a grid of points) are the "mark" and "plate" levels.
  const grab0 = grabWith(similar);
  const seen: number[] = [];
  for (let gy = -0.9; gy <= 0.9; gy += 0.03)
    for (let gx = -0.8; gx <= 0.8; gx += 0.03) {
      const g = grab0(gx, gy);
      if (g >= 0) seen.push(g);
    }
  if (seen.length < 200) return;
  seen.sort((a, b) => a - b);
  const mark = seen[Math.floor(seen.length * 0.04)],
    plate = seen[Math.floor(seen.length * 0.85)];
  if (Math.abs(plate - mark) < 25) return;
  // Each cell is looked at in its middle and a hair to each side.
  const valuesFor = (map: Mapper): number[][] | null => {
    const grab = grabWith(map);
    const values: number[][] = [];
    for (const block of BLOCKS) {
      const row: number[] = [];
      for (const [ring, sector] of block) {
        const c = cellCenter(ring, sector),
          e = 0.006;
        let acc = 0,
          n = 0;
        for (const [ox, oy] of [
          [0, 0],
          [e, 0],
          [-e, 0],
          [0, e],
          [0, -e],
        ]) {
          const v = grab(c.x + ox, c.y + oy);
          if (v >= 0) {
            acc += v;
            n++;
          }
        }
        if (!n) return null;
        row.push(acc / n);
      }
      values.push(row);
    }
    return values;
  };
  if (!straighten) {
    const v = valuesFor(similar);
    if (v) yield { values: v, mark, plate, map: similar };
    return;
  }

  // The bottom dots are looked for in two pictures: one black-or-white by the marks' own middle level (exact for a small dot, which an average-of-the-neighbourhood threshold eats), and
  // the locally-adjusted one (which copes with uneven light). Every dot-like blob around where a dot should be is a candidate (a bit of an arc can look like a dot).
  const mid = (mark + plate) / 2,
    inkIsDark = mark < plate;
  const level = new Uint8Array(w * h);
  for (let i = 0; i < level.length; i++) level[i] = (inkIsDark ? gray[i] < mid : gray[i] > mid) ? 1 : 0;
  const reach = Math.max(8, 0.5 * scale);
  const candidates = (code: { x: number; y: number }): Pt[] => {
    const near = similar(code.x, code.y),
      out: Pt[] = [];
    for (const img of [level, bin])
      for (const c of findDots(img, w, h, near, R_SMALL * scale, reach).slice(0, 6)) if (!out.some((o) => Math.hypot(o.x - c.x, o.y - c.y) < 2.5)) out.push(c);
    return out;
  };
  const cb = candidates(DOTS.bl),
    cr = candidates(DOTS.br);
  // Pairs, likeliest first: each dot's nearest candidate; then the pairs in which each dot is where the other and the two marks say it should be.
  const disagree = (bl: Pt, br: Pt) => {
    const m1 = affineMap(L, R, DOTS.bl, bl),
      m2 = affineMap(L, R, DOTS.br, br);
    if (!m1 || !m2) return Infinity;
    const p1 = m1(DOTS.br.x, DOTS.br.y),
      p2 = m2(DOTS.bl.x, DOTS.bl.y);
    return Math.hypot(p1.x - br.x, p1.y - br.y) + Math.hypot(p2.x - bl.x, p2.y - bl.y);
  };
  const pairs: [Pt, Pt][] = [];
  if (cb[0] && cr[0]) pairs.push([cb[0], cr[0]]);
  const rest: [Pt, Pt, number][] = [];
  for (const x of cb.slice(0, 5)) for (const y of cr.slice(0, 5)) if (!(x === cb[0] && y === cr[0])) rest.push([x, y, disagree(x, y)]);
  rest.sort((p, q) => p[2] - q[2]);
  for (const [x, y, d] of rest.slice(0, 4)) if (d < scale * 1.2) pairs.push([x, y]);
  for (const [bl, br] of pairs) {
    const proj = homography([FINDERS.tl, FINDERS.tr, DOTS.bl, DOTS.br], [L, R, bl, br]);
    const v = proj && valuesFor(proj);
    if (proj && v) yield { values: v, mark, plate, map: proj };
  }
  // Then with one dot only (a smudge, a thumb): three points still fix most of a tilt.
  for (const [code, pt] of [
    [DOTS.bl, cb[0]],
    [DOTS.br, cr[0]],
  ] as const) {
    const m = pt && affineMap(L, R, code, pt);
    const v = m && valuesFor(m);
    if (m && v) yield { values: v, mark, plate, map: m };
  }
}

/** Signed evidence per cell (positive: arc), from grey levels and the two reference levels of the ring the block is in. */
export const evidence = (values: number[][], levels: { ink: number; bare: number }[]): number[][] =>
  values.map((row, b) => {
    const { ink, bare } = levels[BLOCKS[b][0][0]];
    const half = Math.abs(bare - ink) / 2,
      mid = (ink + bare) / 2,
      sign = ink < bare ? -1 : 1;
    return row.map((v) => Math.max(-1.5, Math.min(1.5, (sign * (v - mid)) / half)));
  });
/** Reads the blocks: the likeliest pattern of each, and how sure it is. */
function readBlocks(soft: number[][]): { nibbles: number[]; margin: number[]; scores: number[][] } {
  const nibbles: number[] = [],
    margin: number[] = [],
    scores: number[][] = [];
  for (const row of soft) {
    const sc: number[] = [];
    for (let n = 0; n < PATTERN_COUNT; n++) {
      const p = patternCells(n);
      let s = 0;
      for (let i = 0; i < BLOCK; i++) s += p[i] ? row[i] : -row[i];
      sc.push(s);
    }
    let best = 0;
    for (let n = 1; n < sc.length; n++) if (sc[n] > sc[best]) best = n;
    let second = -Infinity;
    for (let n = 0; n < sc.length; n++) if (n !== best && sc[n] > second) second = sc[n];
    nibbles.push(best);
    margin.push(sc[best] - second);
    scores.push(sc);
  }
  return { nibbles, margin, scores };
}

/** The message in what was read, or null. The shakiest blocks are given up as unreliable, a few more each time, until the repair succeeds. */
function decodeSoft(soft: number[][]): { payload: string; doubt: number } | null {
  const { nibbles, margin } = readBlocks(soft);
  const order = margin
    .map((m, i) => [m, i] as const)
    .sort((a, b) => a[0] - b[0])
    .map(([, i]) => i);
  const shaky = margin.filter((m) => m < 0.8).length;
  if (shaky > 16) return null; // nothing like a clean read: not worth the repair attempts
  for (const give of [0, 2, 4, 6, 8, 10, 12]) {
    const payload = payloadFromNibbles(nibbles, order.slice(0, give));
    if (!payload) continue;
    // Whatever the repair says must also look like the picture: the cells it implies agree with what was seen.
    const grid = dashGrid(payload.padEnd(13, '0'));
    if (!grid) continue;
    let same = 0,
      total = 0;
    BLOCKS.forEach((block, b) =>
      block.forEach(([r, s], k) => {
        total++;
        if (soft[b][k] > 0 === grid[r][s]) same++;
      }),
    );
    if (same / total >= 0.78) return { payload, doubt: give };
  }
  return null;
}

/** The dark and the light level of each stretch from the grey levels of its own cells: a two-way split (the means of the darker and the lighter group, found by a few rounds of
 *  k-means starting from the least and the most). A stretch whose cells are all alike falls back to `base`. */
function stretchLevels(values: number[][], base: { ink: number; bare: number }): { ink: number; bare: number }[] {
  const per: number[][] = Array.from({ length: RINGS }, () => []);
  values.forEach((row, b) => per[BLOCKS[b][0][0]].push(...row));
  return per.map((v) => {
    if (v.length < 10) return base;
    let lo = Math.min(...v),
      hi = Math.max(...v);
    if (hi - lo < 20) return base;
    for (let k = 0; k < 6; k++) {
      const mid = (lo + hi) / 2;
      const a = v.filter((x) => x <= mid),
        c = v.filter((x) => x > mid);
      if (!a.length || !c.length) break;
      lo = a.reduce((p, q) => p + q, 0) / a.length;
      hi = c.reduce((p, q) => p + q, 0) / c.length;
    }
    return { ink: lo, bare: hi };
  });
}

/** Reads the cells given where the top-left (L) and top-right (R) ring marks are. */
function readBytecode(
  gray: Uint8ClampedArray | Uint8Array,
  w: number,
  h: number,
  L: Finder,
  R: Finder,
  bin: Uint8Array,
  straighten: boolean,
): { payload: string; map: Mapper } | null {
  for (const s of hypotheses(gray, w, h, L, R, bin, straighten)) {
    // First with the marks' own levels for every ring; then with levels measured from the cells themselves, ring by ring (blur makes arcs lighter and gaps darker than the marks,
    // and each ring has its own colour, so the middle differs from ring to ring).
    // Here a stretch lies along a line that has different colours beside it (plate, green, pale), so the first levels come from each stretch's own cells: its dark and light ends.
    const own = stretchLevels(s.values, { ink: s.mark, bare: s.plate });
    const hit = decodeSoft(evidence(s.values, own));
    if (hit) return { payload: hit.payload, map: s.map };
    const first = evidence(
      s.values,
      Array.from({ length: RINGS }, () => ({ ink: s.mark, bare: s.plate })),
    );
    const hit0 = decodeSoft(first);
    if (hit0) return { payload: hit0.payload, map: s.map };
    const { nibbles } = readBlocks(first);
    const sum = Array.from({ length: RINGS }, () => ({ ink: 0, ni: 0, bare: 0, nb: 0 }));
    nibbles.forEach((n, b) =>
      patternCells(n).forEach((on, k) => {
        const t = sum[BLOCKS[b][0][0]];
        if (on) {
          t.ink += s.values[b][k];
          t.ni++;
        } else {
          t.bare += s.values[b][k];
          t.nb++;
        }
      }),
    );
    const levels = sum.map((t) => ({ ink: t.ni ? t.ink / t.ni : s.mark, bare: t.nb ? t.bare / t.nb : s.plate }));
    if (levels.some((l) => Math.abs(l.ink - l.bare) < 12)) continue;
    const again = decodeSoft(evidence(s.values, levels));
    if (again) return { payload: again.payload, map: s.map };
  }
  return null;
}

/** Looks for a Bytecode in a grey picture and returns what it says (`m…`, `t…` or `r…` and the key's hex digits) and where it sits, or null. */
export function decodeBytecodeAt(gray: Uint8ClampedArray | Uint8Array, w: number, h: number): { payload: string; spot: ByteSpot } | null {
  const pairs = findEyes(gray, w, h);
  if (!pairs.length) return null;
  const bin = binarize(gray, w, h, true); // his dark lines and the dots on his feet
  for (const [L, R] of pairs)
    for (const straighten of [true, false]) {
      const read = readBytecode(gray, w, h, L, R, bin, straighten);
      if (read) {
        const c = read.map(0, 0),
          e1 = read.map(1, 0),
          e2 = read.map(0, 1);
        return { payload: read.payload, spot: { x: c.x, y: c.y, r: (Math.hypot(e1.x - c.x, e1.y - c.y) + Math.hypot(e2.x - c.x, e2.y - c.y)) / 2 } };
      }
    }
  return null;
}

/** Looks for a Bytecode in a grey picture and returns what it says, or null. */
export const decodeBytecode = (gray: Uint8ClampedArray | Uint8Array, w: number, h: number): string | null => decodeBytecodeAt(gray, w, h)?.payload ?? null;

import {
  BLOCKS,
  BLOCK,
  RINGS,
  PATTERN_COUNT,
  patternCells,
  cellCenter,
  dashGrid,
  payloadFromNibbles,
  patchBits,
  FINDERS,
  NIBBLES,
  OUTLINE_NIBBLES,
  PATCH_NIBBLES,
  PATCH_AT,
  PATCH_H,
} from './layout';
import { LOCATORS } from './marks';
import { STROKES } from './byteArt';
import { type Finder, binarize } from '../tgCode/find';
import { eyePairs } from './eyes';

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

/** Points along Byte's fixed inner lines (the ones no message is written on, so they are the same in every Bytecode), with the direction across each, in code units. */
const FIXED: { x: number; y: number; nx: number; ny: number }[] = [];
for (const st of STROKES) {
  if (st.ok || st.halo) continue;
  let len = 0;
  for (let i = 1; i < st.pts.length; i++) len += Math.hypot(st.pts[i][0] - st.pts[i - 1][0], st.pts[i][1] - st.pts[i - 1][1]);
  if (len < 0.25) continue;
  let next = 0,
    run = 0;
  for (let i = 1; i < st.pts.length; i++) {
    const [x0, y0] = st.pts[i - 1],
      [x1, y1] = st.pts[i];
    const seg = Math.hypot(x1 - x0, y1 - y0);
    while (next <= run + seg && seg > 0) {
      const t = (next - run) / seg;
      FIXED.push({ x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t, nx: -(y1 - y0) / seg, ny: (x1 - x0) / seg });
      next += 0.035;
    }
    run += seg;
  }
}

/** Bilinear grey at a picture point, or -1 outside. */
const greyAt = (gray: Uint8ClampedArray | Uint8Array, w: number, h: number, x: number, y: number) => {
  if (x < 1 || y < 1 || x >= w - 2 || y >= h - 2) return -1;
  const x0 = Math.floor(x),
    y0 = Math.floor(y),
    fx = x - x0,
    fy = y - y0;
  return gray[y0 * w + x0] * (1 - fx) * (1 - fy) + gray[y0 * w + x0 + 1] * fx * (1 - fy) + gray[(y0 + 1) * w + x0] * (1 - fx) * fy + gray[(y0 + 1) * w + x0 + 1] * fx * fy;
};

/** Sharpens a map with Byte's fixed lines. Where the map puts each of those lines, the picture is searched a pixel or two across it for the darkest place (his lines are the darkest thing
 *  beside them), and the map is fitted again to where they really are, together with the points it was fitted to before. A few rounds, narrower each time; the result is kept only if
 *  his lines come out darker under it than under the map it started from. */
function refine(gray: Uint8ClampedArray | Uint8Array, w: number, h: number, map: Mapper, code: Pt[], image: Pt[], scale: number): Mapper {
  const darkness = (m: Mapper) => {
    let sum = 0,
      n = 0;
    for (const f of FIXED) {
      const q = m(f.x, f.y),
        g = greyAt(gray, w, h, q.x, q.y);
      if (g >= 0) {
        sum += g;
        n++;
      }
    }
    return n ? sum / n : Infinity;
  };
  let cur = map;
  for (const reach of [Math.max(1.6, scale * 0.028), Math.max(1.1, scale * 0.016), Math.max(0.8, scale * 0.009)]) {
    const src: Pt[] = [...code],
      dst: Pt[] = [...image];
    const steps = Math.round(reach / 0.4);
    for (const f of FIXED) {
      const q = cur(f.x, f.y),
        a = cur(f.x + f.nx * 0.01, f.y + f.ny * 0.01);
      const ax = a.x - q.x,
        ay = a.y - q.y,
        al = Math.hypot(ax, ay);
      if (al < 1e-9) continue;
      const ux = ax / al,
        uy = ay / al;
      const prof: number[] = [];
      for (let k = -steps; k <= steps; k++) prof.push(greyAt(gray, w, h, q.x + ux * k * 0.4, q.y + uy * k * 0.4));
      if (prof.some((g) => g < 0)) continue;
      let best = 1;
      for (let k = 1; k < prof.length - 1; k++) if (prof[k - 1] + prof[k] + prof[k + 1] < prof[best - 1] + prof[best] + prof[best + 1]) best = k;
      if (best <= 1 || best >= prof.length - 2) continue; // at the edge of the search: not a line found, a slope
      const dip = Math.min(prof[0], prof[prof.length - 1]) - prof[best];
      if (dip < 12) continue;
      const t = (best - steps) * 0.4;
      src.push({ x: f.x, y: f.y });
      dst.push({ x: q.x + ux * t, y: q.y + uy * t });
    }
    if (src.length < code.length + 40) break;
    const next = fitHomography(src, dst);
    if (!next) break;
    cur = next;
  }
  return darkness(cur) < darkness(map) - 0.5 ? cur : map;
}

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
): Generator<{ values: number[][]; mark: number; plate: number; map: Mapper; strict?: boolean }> {
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
  // How well the cells fit the allowed patterns under a map: the mean over the blocks of the score of the best-fitting pattern. A map that is right makes every block fit one of the 16
  // patterns closely (7 or more); a wrong one fits none of them (below about 6.3).
  const quality = (values: number[][]) => {
    const own = stretchLevels(values, { ink: mark, bare: plate });
    const { scores } = readBlocks(evidence(values, own));
    return scores.reduce((t, sc) => t + Math.max(...sc), 0) / scores.length;
  };
  // A map that nearly fits is nudged: the picture positions of four spread points are moved a fraction of a pixel at a time, one coordinate after another, and a move is kept when the
  // cells then fit the patterns better. That undoes the few pixels of error that the shapes' middles leave, which is more than a thin line allows.
  const tune = (map: Mapper, start: number): { map: Mapper; values: number[][] } | null => {
    const C: Pt[] = [
      { x: -0.8, y: -0.8 },
      { x: 0.8, y: -0.8 },
      { x: 0.8, y: 0.8 },
      { x: -0.8, y: 0.8 },
    ];
    const at = C.map((c) => map(c.x, c.y));
    const build = (pts: Pt[]) => fitHomography(C, pts);
    let best = start,
      bestMap = map,
      bestValues: number[][] | null = null;
    const k = Math.max(1, scale / 130);
    for (const step of [0.9 * k, 0.45 * k, 0.22 * k])
      for (let sweep = 0; sweep < 2; sweep++) {
        let moved = false;
        for (let i = 0; i < 8; i++)
          for (const dir of [1, -1]) {
            const pts = at.map((p) => ({ ...p }));
            if (i % 2) pts[i >> 1].y += dir * step;
            else pts[i >> 1].x += dir * step;
            const m = build(pts);
            const v = m && valuesFor(m);
            if (!m || !v) continue;
            const q = quality(v);
            if (q > best + 1e-3) {
              best = q;
              bestMap = m;
              bestValues = v;
              at[i >> 1] = pts[i >> 1];
              moved = true;
              break;
            }
          }
        if (!moved) break;
      }
    return bestValues ? { map: bestMap, values: bestValues } : null;
  };
  function* emit(m: Mapper): Generator<{ values: number[][]; mark: number; plate: number; map: Mapper }> {
    const v = valuesFor(m);
    if (!v) return;
    yield { values: v, mark, plate, map: m };
    const q = quality(v);
    if (q < 6.4) return; // nothing like a fit: not worth nudging
    const t = tune(m, q);
    if (t) yield { values: t.values, mark, plate, map: t.map };
  }
  // Each map comes sharpened by his fixed lines first, then as it was (the sharpening is only kept when it helps, but a try without it costs little).
  const variants = (map: Mapper, code: Pt[], image: Pt[]): Mapper[] => {
    const sharp = refine(gray, w, h, map, code, image, scale);
    return sharp === map ? [map] : [sharp, map];
  };
  if (!straighten) {
    for (const m of variants(similar, [FINDERS.tl, FINDERS.tr], [L, R])) yield* emit(m);
    return;
  }

  // The two other locators are Byte's yellow scarf and a facet of his yellow gem: each is a closed shape with a dark outline, so the light pixels joined to the pixel where the eyes say it
  // should be are the shape, and their middle is the locator. The shape must have about the size it should have at this scale (a shape that leaks out of a gap in its outline is too big).
  const find = (m: { x: number; y: number; area: number; rmax: number }, near: Pt): (Pt & { pix: number[] }) | null => {
    const want = m.area * scale * scale,
      reach = Math.max(4, m.rmax * scale * 0.5);
    let start = -1,
      best = Infinity;
    for (let y = Math.max(0, Math.floor(near.y - reach)); y <= Math.min(h - 1, Math.ceil(near.y + reach)); y++)
      for (let x = Math.max(0, Math.floor(near.x - reach)); x <= Math.min(w - 1, Math.ceil(near.x + reach)); x++)
        if (!bin[y * w + x]) {
          const d = Math.hypot(x - near.x, y - near.y);
          if (d < best) {
            best = d;
            start = y * w + x;
          }
        }
    if (start < 0) return null;
    const lim = Math.ceil(m.rmax * scale * 1.7);
    const seen = new Set<number>([start]),
      stack = [start];
    let sx = 0,
      sy = 0,
      n = 0;
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % w,
        y = (i - x) / w;
      sx += x;
      sy += y;
      if (++n > want * 1.9) return null; // it leaks
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx,
          ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h || Math.abs(nx - near.x) > lim || Math.abs(ny - near.y) > lim) continue;
        const j = ny * w + nx;
        if (!bin[j] && !seen.has(j)) {
          seen.add(j);
          stack.push(j);
        }
      }
    }
    return n < want * 0.45 ? null : { x: sx / n, y: sy / n, pix: [...seen] };
  };
  let found = LOCATORS.map((m) => find(m, similar(m.x, m.y)));
  // On a tilted picture the turn-and-scale guess is off by a few pixels, enough for the small gem to be taken for the facet beside it. So the big shapes (scarf, wings) are fitted first,
  // and every shape is looked for again where that better fit says it is.
  const bigs = [1, 2, 3].filter((i) => found[i]);
  const guess: Mapper | null =
    bigs.length >= 2
      ? fitHomography([FINDERS.tl, FINDERS.tr, ...bigs.map((i) => LOCATORS[i])], [L, R, ...bigs.map((i) => found[i]!)])
      : bigs.length === 1
        ? affineMap(L, R, LOCATORS[bigs[0]], found[bigs[0]]!)
        : null;
  if (guess) {
    const again = LOCATORS.map((m) => {
      const p = guess(m.x, m.y);
      return find(m, p);
    });
    found = found.map((f, i) => (i === 0 ? again[0] : (again[i] ?? f)));
  }
  const have = LOCATORS.map((_, i) => i).filter((i) => found[i]);
  if (have.length >= 2) {
    // The middle of a shape in a tilted picture is not quite where the middle of the real shape is (a far part looks smaller), which matters for a big shape like a wing. So the fit is
    // corrected a few times: the shape's pixels are laid back into the code with the current fit, and where their middle falls, against where it should, moves the point the fit uses.
    const code = [FINDERS.tl, FINDERS.tr, ...have.map((i) => LOCATORS[i])];
    const image: Pt[] = [L, R, ...have.map((i) => ({ x: found[i]!.x, y: found[i]!.y }))];
    for (let round = 0; round < 3; round++) {
      const H = fitHomography(code, image),
        Hinv = fitHomography(image, code);
      if (!H || !Hinv) break;
      have.forEach((i, k) => {
        const lm = LOCATORS[i],
          pix = found[i]!.pix;
        let cx = 0,
          cy = 0,
          m = 0;
        const stride = Math.max(1, Math.floor(pix.length / 400));
        for (let j = 0; j < pix.length; j += stride) {
          const q = Hinv(pix[j] % w, Math.floor(pix[j] / w));
          cx += q.x;
          cy += q.y;
          m++;
        }
        const e = 0.01,
          o = H(lm.x, lm.y),
          jx = H(lm.x + e, lm.y),
          jy = H(lm.x, lm.y + e);
        const dx = cx / m - lm.x,
          dy = cy / m - lm.y;
        const at = image[2 + k];
        image[2 + k] = { x: at.x + ((jx.x - o.x) / e) * dx + ((jy.x - o.x) / e) * dy, y: at.y + ((jx.y - o.y) / e) * dx + ((jy.y - o.y) / e) * dy };
      });
    }
    const proj = fitHomography(code, image);
    if (proj) for (const m of variants(proj, code, image)) yield* emit(m);
  }
  // Then with one of them only (a thumb over the others): three points still fix most of a tilt.
  for (const i of have) {
    const am = affineMap(L, R, LOCATORS[i], found[i]!);
    if (am) for (const m of variants(am, [FINDERS.tl, FINDERS.tr, LOCATORS[i]], [L, R, found[i]!])) yield* emit(m);
  }
}

/** The projective map that best takes code points to picture points (a least-squares fit through all of them; four or more). */
function fitHomography(src: Pt[], dst: Pt[]): Mapper | null {
  const A: number[][] = Array.from({ length: 8 }, () => new Array<number>(9).fill(0));
  for (let i = 0; i < src.length; i++) {
    const { x, y } = src[i],
      { x: u, y: v } = dst[i];
    for (const [row, rhs] of [
      [[x, y, 1, 0, 0, 0, -u * x, -u * y], u],
      [[0, 0, 0, x, y, 1, -v * x, -v * y], v],
    ] as const)
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) A[r][c] += row[r] * row[c];
        A[r][8] += row[r] * rhs;
      }
  }
  for (let c = 0; c < 8; c++) {
    let piv = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    if (Math.abs(A[piv][c]) < 1e-12) return null;
    [A[c], A[piv]] = [A[piv], A[c]];
    for (let r = 0; r < 8; r++)
      if (r !== c) {
        const f = A[r][c] / A[c][c];
        for (let k = c; k < 9; k++) A[r][k] -= f * A[c][k];
      }
  }
  const hh = A.map((row, i) => row[8] / row[i]);
  return (x, y) => {
    const d = hh[6] * x + hh[7] * y + 1;
    return { x: (hh[0] * x + hh[1] * y + hh[2]) / d, y: (hh[3] * x + hh[4] * y + hh[5]) / d };
  };
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

/** What the shade patches say: one number per pair (positive: the left square was the lighter, a 1). A pair is read by comparing its two squares' grey levels, so nothing has to be known about
 *  the colour they lie on or the light; the sizes of the differences are judged against the typical one over all the pairs. Null when the picture shows no such differences at all. */
function patchEvidence(gray: Uint8ClampedArray | Uint8Array, w: number, h: number, map: Mapper): number[] | null {
  const square = (c: [number, number]) => {
    let acc = 0,
      n = 0;
    for (const [dx, dy] of [
      [0, 0],
      [0.5, 0],
      [-0.5, 0],
      [0, 0.5],
      [0, -0.5],
    ]) {
      const p = map(c[0] + dx * PATCH_H, c[1] + dy * PATCH_H);
      const v = greyAt(gray, w, h, p.x, p.y);
      if (v >= 0) {
        acc += v;
        n++;
      }
    }
    return n ? acc / n : -1;
  };
  const diffs = PATCH_AT.map((p) => {
    const a = square(p.left),
      b = square(p.right);
    return a < 0 || b < 0 ? 0 : a - b;
  });
  const typical = [...diffs.map(Math.abs)].sort((a, b) => a - b)[Math.floor(diffs.length / 2)];
  if (typical < 3) return null;
  return diffs.map((d) => Math.max(-1.5, Math.min(1.5, d / typical)));
}

/** The message in what was read, or null: the outline's blocks (`soft`) and the patches (`pev`, which may be missing: then those half-bytes are simply unknown). The shakiest half-bytes are
 *  given up as unreliable, a few more each time, until the repair succeeds. */
function decodeSoft(soft: number[][], pev: number[] | null, strict = false): { payload: string; doubt: number } | null {
  const { nibbles: outNib, margin: outMargin } = readBlocks(soft);
  const nibbles: number[] = new Array(NIBBLES).fill(0),
    margin: number[] = new Array(NIBBLES).fill(-1); // (an unknown half-byte has the least margin, so it is given up first)
  outNib.forEach((n, k) => {
    nibbles[OUTLINE_NIBBLES[k]] = n;
    margin[OUTLINE_NIBBLES[k]] = outMargin[k];
  });
  if (pev)
    PATCH_NIBBLES.forEach((q, j) => {
      let best = 0,
        second = -Infinity;
      const sc: number[] = [];
      for (let n = 0; n < PATTERN_COUNT; n++) {
        let t = 0;
        for (let k = 0; k < 4; k++) t += ((n >> (3 - k)) & 1 ? 1 : -1) * pev[4 * j + k];
        sc.push(t);
        if (t > sc[best]) best = n;
      }
      sc.forEach((t, n) => {
        if (n !== best && t > second) second = t;
      });
      nibbles[q] = best;
      margin[q] = (sc[best] - second) * 2.5; // (a patch half-byte's scores run over a smaller range than a block's)
    });
  const order = margin
    .map((m, i) => [m, i] as const)
    .sort((a, b) => a[0] - b[0])
    .map(([, i]) => i);
  const shaky = margin.filter((m) => m < 0.8).length;
  if (shaky > 18) return null; // nothing like a clean read: not worth the repair attempts
  for (const give of strict ? [0, 2, 4] : [0, 2, 4, 6, 8, 10, 12]) {
    const payload = payloadFromNibbles(nibbles, order.slice(0, give));
    if (!payload) continue;
    // Whatever the repair says must also look like the picture: the cells (and the patches) it implies agree with what was seen.
    const grid = dashGrid(payload.padEnd(13, '0'));
    const bits = patchBits(payload.padEnd(13, '0'));
    if (!grid || !bits) continue;
    let same = 0,
      total = 0;
    BLOCKS.forEach((block, b) =>
      block.forEach(([r, s], k) => {
        total++;
        if (soft[b][k] > 0 === grid[r][s]) same++;
      }),
    );
    if (pev)
      bits.forEach((bit, i) => {
        total++;
        if (pev[i] > 0 === (bit === 1)) same++;
      });
    if (same / total >= (strict ? 0.9 : 0.78)) return { payload, doubt: give };
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
    // Which end is the bar? Most cells of a block are bars (a block is at least seven bars in ten), so the end with more cells is: dark on a pale plate, light on a dark one.
    const darker = v.filter((x) => x <= (lo + hi) / 2).length;
    return darker * 2 >= v.length ? { ink: lo, bare: hi } : { ink: hi, bare: lo };
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
    const pev = patchEvidence(gray, w, h, s.map);
    const hit = decodeSoft(evidence(s.values, own), pev, s.strict);
    if (hit) return { payload: hit.payload, map: s.map };
    const first = evidence(
      s.values,
      Array.from({ length: RINGS }, () => ({ ink: s.mark, bare: s.plate })),
    );
    const hit0 = decodeSoft(first, pev, s.strict);
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
    const again = decodeSoft(evidence(s.values, levels), pev, s.strict);
    if (again) return { payload: again.payload, map: s.map };
  }
  return null;
}

/** The picture made twice as big in each direction (bilinear), so a small, distant code has cells big enough for the placement and the shape-finding to work as they do on a closer one. */
function doubled(gray: Uint8ClampedArray | Uint8Array, w: number, h: number): { gray: Uint8ClampedArray; w: number; h: number } {
  const W = w * 2,
    H = h * 2;
  const out = new Uint8ClampedArray(W * H);
  for (let y = 0; y < H; y++) {
    const sy = Math.min(h - 1.001, Math.max(0, (y - 0.5) / 2)),
      y0 = Math.floor(sy),
      fy = sy - y0;
    for (let x = 0; x < W; x++) {
      const sx = Math.min(w - 1.001, Math.max(0, (x - 0.5) / 2)),
        x0 = Math.floor(sx),
        fx = sx - x0;
      const i = y0 * w + x0;
      out[y * W + x] = gray[i] * (1 - fx) * (1 - fy) + gray[i + 1] * fx * (1 - fy) + gray[i + w] * (1 - fx) * fy + gray[i + w + 1] * fx * fy;
    }
  }
  return { gray: out, w: W, h: H };
}

const spotOf = (found: { payload: string; map: Mapper }, k: number): { payload: string; spot: ByteSpot } => {
  const c = found.map(0, 0),
    e1 = found.map(1, 0),
    e2 = found.map(0, 1);
  return { payload: found.payload, spot: { x: c.x / k, y: c.y / k, r: (Math.hypot(e1.x - c.x, e1.y - c.y) + Math.hypot(e2.x - c.x, e2.y - c.y)) / 2 / k } };
};

/** One look at one picture; `eyes.u` is told how many pixels a code unit was at the first pair of eyes found (0 when there was none). */
function lookOnce(gray: Uint8ClampedArray | Uint8Array, w: number, h: number, eyes: { u: number }) {
  const bin = binarize(gray, w, h, true); // his dark lines
  for (const [L, R] of eyePairs(gray, w, h)) {
    if (!eyes.u) eyes.u = L.u;
    for (const straighten of [true, false]) {
      const read = readBytecode(gray, w, h, L, R, bin, straighten);
      if (read) return read;
    }
  }
  return null;
}

const SMALL = 105; // pixels per code unit under which the picture is also tried made bigger (a code about 210 px across or less)

/** Looks for a Bytecode in a grey picture and returns what it says (`m…`, `t…` or `r…` and the key's hex digits) and where it sits, or null. A code that is small in the picture (his eyes close
 *  together) that does not read as it is gets one more try on the picture made twice as big. */
export function decodeBytecodeAt(gray: Uint8ClampedArray | Uint8Array, w: number, h: number): { payload: string; spot: ByteSpot } | null {
  const eyes = { u: 0 };
  const first = lookOnce(gray, w, h, eyes);
  if (first) return spotOf(first, 1);
  if (eyes.u && eyes.u < SMALL) {
    const big = doubled(gray, w, h);
    const again = lookOnce(big.gray, big.w, big.h, { u: 0 });
    if (again) return spotOf(again, 2);
  }
  return null;
}

/** Looks for a Bytecode in a grey picture and returns what it says, or null. */
export const decodeBytecode = (gray: Uint8ClampedArray | Uint8Array, w: number, h: number): string | null => decodeBytecodeAt(gray, w, h)?.payload ?? null;

export const __debug = { hypotheses, stretchLevels, evidence, readBlocks };

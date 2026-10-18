import { DATA_CELLS, R_OUT, DOTS, FINDERS, R_SMALL, SPAN, U, cellCenter, payloadFromBits } from './layout';

// Reads a ring code out of a camera picture (grey values, width × height). No library: it finds the three finder marks the way a QR reader does, works out
// where the code sits (position, size, turn, and a little tilt from the three marks), reads each cell where the dash would be, and lets the repair bytes
// settle what a blurred or glared cell got wrong. Light marks on a dark plate (the portal's dark theme) read just as well as dark on light.

interface Finder { x: number; y: number; u: number }

const near = (run: number, expect: number, tol: number) => Math.abs(run - expect) <= tol;
// dark, light, dark(wide), light, dark in the ratio 1:1:3:1:1
function ratio11311(r: number[]): number {
  const total = r[0] + r[1] + r[2] + r[3] + r[4];
  const u = total / 7;
  const t = u * 0.7;
  return near(r[0], u, t) && near(r[1], u, t) && near(r[2], 3 * u, 3 * t * 0.9) && near(r[3], u, t) && near(r[4], u, t) ? u : 0;
}

function verticalCheck(bin: Uint8Array, w: number, h: number, x: number, y: number, u: number): { y: number; u: number } | null {
  const at = (yy: number) => bin[yy * w + x];
  let up = y; while (up >= 0 && at(up) === 1) up--;           // centre dark run, upwards
  let down = y; while (down < h && at(down) === 1) down++;
  if (up < 0 || down >= h) return null;
  const c = down - up - 1;
  let u1 = up; while (u1 >= 0 && at(u1) === 0) u1--;
  let d1 = down; while (d1 < h && at(d1) === 0) d1++;
  if (u1 < 0 || d1 >= h) return null;
  const l1 = up - u1, l2 = d1 - down;
  let u2 = u1; while (u2 >= 0 && at(u2) === 1) u2--;
  let d2 = d1; while (d2 < h && at(d2) === 1) d2++;
  const r0 = u1 - u2, r4 = d2 - d1;
  const uu = ratio11311([r0, l1, c, l2, r4]);
  if (!uu || Math.abs(uu - u) > u * 0.6) return null;
  return { y: (up + 1 + down - 1) / 2, u: uu };
}

function findFinders(bin: Uint8Array, w: number, h: number): Finder[] {
  const cands: Finder[] = [];
  for (let y = 0; y < h; y++) {
    const runs: number[] = [], starts: number[] = [], colors: number[] = [];
    let x = 0;
    while (x < w) {
      const c = bin[y * w + x]; let e = x; while (e < w && bin[y * w + e] === c) e++;
      starts.push(x); runs.push(e - x); colors.push(c); x = e;
    }
    for (let i = 0; i + 4 < runs.length; i++) {
      if (colors[i] !== 1) continue;
      const u = ratio11311(runs.slice(i, i + 5));
      if (!u || u < 1.2) continue;
      const cx = starts[i + 2] + (runs[i + 2] - 1) / 2;
      const v = verticalCheck(bin, w, h, Math.floor(cx), y, u);
      if (v) cands.push({ x: cx, y: v.y, u: (u + v.u) / 2 });
    }
  }
  // Merge the hits of one mark (many rows) into its centre.
  const clusters: { x: number; y: number; u: number; n: number }[] = [];
  for (const c of cands) {
    const hit = clusters.find((k) => Math.hypot(k.x - c.x, k.y - c.y) < Math.max(2, c.u * 1.5));
    if (hit) { hit.x = (hit.x * hit.n + c.x) / (hit.n + 1); hit.y = (hit.y * hit.n + c.y) / (hit.n + 1); hit.u = (hit.u * hit.n + c.u) / (hit.n + 1); hit.n++; }
    else clusters.push({ ...c, n: 1 });
  }
  return clusters.filter((k) => k.n >= 2).map(({ x, y, u }) => ({ x, y, u }));
}

/** Pairs of ring marks that could be the top-left and top-right ones (similar size, the right distance apart), best first. */
function pickPairs(f: Finder[]): [Finder, Finder][] {
  const out: { pair: [Finder, Finder]; score: number }[] = [];
  for (let a = 0; a < f.length; a++) for (let b = a + 1; b < f.length; b++) {
    const A = f[a], B = f[b], um = (A.u + B.u) / 2;
    if (Math.max(A.u, B.u) > um * 1.25 || Math.min(A.u, B.u) < um * 0.8) continue;
    const units = Math.hypot(B.x - A.x, B.y - A.y) / um / (SPAN / U);
    if (units < 0.75 || units > 1.3) continue;
    out.push({ pair: [A, B], score: Math.abs(units - 1) });
  }
  return out.sort((p, q) => p.score - q.score).slice(0, 4).map((p) => p.pair);
}

/** Reads the cells given where the top-left (L) and top-right (R) ring marks are. Straightened by the two bottom dots when both are found, otherwise by the two marks alone. */
function readCells(gray: Uint8ClampedArray | Uint8Array, w: number, h: number, L: Finder, R: Finder, bin: Uint8Array, straighten: boolean): { cells: number[]; map: (x: number, y: number) => { x: number; y: number } } | null {
  // Code units → picture as a turn and a scale fixed by the two marks.
  const dx = (R.x - L.x) / SPAN, dy = (R.y - L.y) / SPAN;   // the picture's step for one code unit along "right"; "down" is that turned a quarter
  const similar = (x: number, y: number) => { const fx = x - FINDERS.tl.x, fy = y - FINDERS.tl.y; return { x: L.x + fx * dx - fy * dy, y: L.y + fx * dy + fy * dx }; };
  const scale = Math.hypot(dx, dy);   // pixels per code unit
  let map = similar;
  if (straighten) {
    const bl = findDot(bin, w, h, similar(DOTS.bl.x, DOTS.bl.y), R_SMALL * scale), br = findDot(bin, w, h, similar(DOTS.br.x, DOTS.br.y), R_SMALL * scale);
    if (!bl || !br) return null;
    const proj = homography([FINDERS.tl, FINDERS.tr, DOTS.bl, DOTS.br], [L, R, bl, br]);
    if (!proj) return null;
    map = proj;
  }
  const grab = (x: number, y: number) => {
    const p = map(x, y); const px = Math.round(p.x), py = Math.round(p.y);
    if (px < 1 || py < 1 || px >= w - 1 || py >= h - 1) return -1;
    let s = 0; for (let yy = -1; yy <= 1; yy++) for (let xx = -1; xx <= 1; xx++) s += gray[(py + yy) * w + px + xx];
    return s / 9;
  };
  // Reference levels from the marks themselves: the middle of a mark is a "mark" colour, the gap ring around it is the plate colour.
  let mark = 0, plate = 0, nm = 0, np = 0;
  for (const f of [FINDERS.tl, FINDERS.tr]) {
    const m = grab(f.x, f.y); if (m < 0) return null; mark += m; nm++;
    for (let k = 0; k < 4; k++) { const a = (k * Math.PI) / 2 + Math.PI / 4; const p = grab(f.x + 2 * U * Math.cos(a), f.y + 2 * U * Math.sin(a)); if (p >= 0) { plate += p; np++; } }
  }
  if (!nm || !np) return null;
  mark /= nm; plate /= np;
  if (Math.abs(plate - mark) < 25) return null;
  const thr = (mark + plate) / 2, darkMarks = mark < plate;
  const cells = new Array<number>(DATA_CELLS.length).fill(0);
  for (let i = 0; i < DATA_CELLS.length; i++) {
    const c = cellCenter(DATA_CELLS[i][0], DATA_CELLS[i][1]);
    let acc = 0, n = 0;
    for (const [ox, oy] of [[0, 0], [0.012, 0], [-0.012, 0], [0, 0.012], [0, -0.012]]) { const v = grab(c.x + ox, c.y + oy); if (v >= 0) { acc += v; n++; } }
    if (!n) return null;
    const v = acc / n;
    cells[i] = (darkMarks ? v < thr : v > thr) ? 1 : 0;
  }
  return { cells, map };
}

/** The centre of the solid round blob of marks (a dot of about `radius` pixels) nearest to `near`, or null. Every blob in reach is looked at, so a dash or a smudge close by cannot hide it. */
function findDot(bin: Uint8Array, w: number, h: number, near: { x: number; y: number }, radius: number): { x: number; y: number } | null {
  const reach = Math.max(6, radius * 7);
  const disc = Math.PI * radius * radius;
  const seen = new Set<number>();
  let best: { x: number; y: number } | null = null, bestD = Infinity;
  for (let y0 = Math.max(0, Math.floor(near.y - reach)); y0 <= Math.min(h - 1, Math.ceil(near.y + reach)); y0++)
    for (let x0 = Math.max(0, Math.floor(near.x - reach)); x0 <= Math.min(w - 1, Math.ceil(near.x + reach)); x0++) {
      const start = y0 * w + x0;
      if (!bin[start] || seen.has(start)) continue;
      seen.add(start);
      const queue = [start];
      let n = 0, sumX = 0, sumY = 0, minX = w, maxX = 0, minY = h, maxY = 0, tooBig = false;
      while (queue.length) {
        const i = queue.pop()!; const x = i % w, y = (i - x) / w;
        n++; sumX += x; sumY += y; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
        if (n > disc * 2.2 + 20) { tooBig = true; }
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h || !bin[ny * w + nx]) continue;
          const k = ny * w + nx; if (!seen.has(k)) { seen.add(k); if (!tooBig) queue.push(k); }
        }
      }
      if (tooBig) continue;
      const bw = maxX - minX + 1, bh = maxY - minY + 1;
      if (n < disc * 0.55 || n > disc * 2 || bw / bh < 0.72 || bw / bh > 1.4 || n < bw * bh * 0.66) continue;   // a solid round blob, not a dash
      const cx = sumX / n, cy = sumY / n, d = Math.hypot(cx - near.x, cy - near.y);
      if (d < bestD) { bestD = d; best = { x: cx, y: cy }; }
    }
  return best;
}

/** Solves the 3×3 projective map that takes four code points to four picture points (null when they do not allow one). */
function homography(src: { x: number; y: number }[], dst: { x: number; y: number }[]): ((x: number, y: number) => { x: number; y: number }) | null {
  const M: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i], { x: u, y: v } = dst[i];
    M.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    M.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  for (let c = 0; c < 8; c++) {
    let piv = c; for (let r = c + 1; r < 8; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    if (Math.abs(M[piv][c]) < 1e-12) return null;
    [M[c], M[piv]] = [M[piv], M[c]];
    for (let r = 0; r < 8; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k < 9; k++) M[r][k] -= f * M[c][k]; }
  }
  const h = M.map((row, i) => row[8] / row[i]);
  return (x, y) => { const d = h[6] * x + h[7] * y + 1; return { x: (h[0] * x + h[1] * y + h[2]) / d, y: (h[3] * x + h[4] * y + h[5]) / d }; };
}

/** Black-or-white by comparing each pixel with the average around it, so a plate of any brightness, in any light, against any background, reads the same. */
function binarize(gray: Uint8ClampedArray | Uint8Array, w: number, h: number, darkMarks: boolean): Uint8Array {
  const integral = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) { let row = 0; for (let x = 0; x < w; x++) { row += gray[y * w + x]; integral[(y + 1) * (w + 1) + x + 1] = integral[y * (w + 1) + x + 1] + row; } }
  const r = Math.max(8, Math.round(Math.min(w, h) * 0.09));
  const bin = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1);
      const sum = integral[y1 * (w + 1) + x1] - integral[y0 * (w + 1) + x1] - integral[y1 * (w + 1) + x0] + integral[y0 * (w + 1) + x0];
      const mean = sum / ((x1 - x0) * (y1 - y0));
      const g = gray[y * w + x];
      bin[y * w + x] = (darkMarks ? g < mean - 10 : g > mean + 10) ? 1 : 0;
    }
  }
  return bin;
}

/** Where a ring code was found in the picture: its centre and radius, in picture pixels. */
export interface RingSpot { x: number; y: number; r: number }

/** Looks for a ring code in a grey picture and returns what it says (`m…`, `t…` or `r…` and twelve hex digits) and where it sits, or null. */
export function decodeRingCodeAt(gray: Uint8ClampedArray | Uint8Array, w: number, h: number): { payload: string; spot: RingSpot } | null {
  for (const darkMarks of [true, false]) {
    const bin = binarize(gray, w, h, darkMarks);
    const finders = findFinders(bin, w, h);
    if (finders.length < 2) continue;
    for (const [P, Q] of pickPairs(finders)) {
      // Which of the two is the left one is not known: try both (the wrong one cannot pass the repair check). Straightened by the bottom dots when they are found.
      for (const [L, R] of [[P, Q], [Q, P]] as [Finder, Finder][]) {
        for (const straighten of [true, false]) {
          const read = readCells(gray, w, h, L, R, bin, straighten);
          const payload = read && payloadFromBits(read.cells);
          if (payload && read) {
            const c = read.map(0, 0), e1 = read.map(R_OUT, 0), e2 = read.map(0, R_OUT);
            return { payload, spot: { x: c.x, y: c.y, r: (Math.hypot(e1.x - c.x, e1.y - c.y) + Math.hypot(e2.x - c.x, e2.y - c.y)) / 2 } };
          }
        }
      }
    }
  }
  return null;
}

/** Looks for a ring code in a grey picture and returns what it says, or null. */
export const decodeRingCode = (gray: Uint8ClampedArray | Uint8Array, w: number, h: number): string | null => decodeRingCodeAt(gray, w, h)?.payload ?? null;
